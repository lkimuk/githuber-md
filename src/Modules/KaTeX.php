<?php
/**
 * Module Name: KaTex
 * Module Description: Use KaTex markup for complex equations and other geekery.
 *
 * @author Terry Lin
 * @link https://terryl.in/
 *
 * @package Githuber
 * @since 1.0.0
 * @version 1.14.0
 */

namespace Githuber\Module;

/**
 * KaTeX.
 */
class KaTeX extends ModuleAbstract {

	/**
	 * The version of KaTeX we are using.
	 *
	 * @var string
	 */
	public $katex_version = '0.12.0';

	/**
	 * The priority order to load CSS file, the value should be higher than theme's.
	 * Overwrite the theme's style it's safe to display the correct syntax highlight.
	 *
	 * @var integer
	 */
	public $css_priority = 1000;

	/**
	 * Constants.
	 */
	const MD_POST_META_KATEX = '_is_githuber_katex';

	/**
	 * Constructer.
	 */
	public function __construct() {
		parent::__construct();
	}

	/**
	 * Initialize.
	 *
	 * @return void
	 */
	public function init() {
		add_action( 'wp_enqueue_scripts', array( $this, 'front_enqueue_styles' ), $this->css_priority );
		add_action( 'wp_enqueue_scripts', array( $this, 'front_enqueue_scripts' ) );
		add_action( 'wp_print_footer_scripts', array( $this, 'front_print_footer_scripts' ), 99 );
	}

	/**
	 * Register CSS style files for frontend use.
	 *
	 * @return void
	 */
	public function front_enqueue_styles() {
		if ( $this->is_module_should_be_loaded( self::MD_POST_META_KATEX ) ) {

			$option = githuber_get_option( 'katex_src', 'githuber_modules' );

			switch ( $option ) {
				case 'cloudflare':
					$style_url = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/' . $this->katex_version . '/katex.min.css';
					break;

				case 'jsdelivr':
					$style_url = 'https://cdn.jsdelivr.net/npm/katex@' . $this->katex_version . '/dist/katex.min.css';
					break;

				default:
					$style_url = $this->githuber_plugin_url . 'assets/vendor/katex/katex.min.css';
					break;
			}
			wp_enqueue_style( 'katex', $style_url, array(), $this->katex_version, 'all' );
		}
	}

	/**
	 * Register JS files for frontend use.
	 *
	 * @return void
	 */
	public function front_enqueue_scripts() {
		if ( $this->is_module_should_be_loaded( self::MD_POST_META_KATEX ) ) {

			$option = githuber_get_option( 'katex_src', 'githuber_modules' );

			switch ( $option ) {
				case 'cloudflare':
					$script_url = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/' . $this->katex_version . '/katex.min.js';
					$auto_render_script_url = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/' . $this->katex_version . '/contrib/auto-render.min.js';
					break;

				case 'jsdelivr':
					$script_url = 'https://cdn.jsdelivr.net/npm/katex@' . $this->katex_version . '/dist/katex.min.js';
					$auto_render_script_url = 'https://cdn.jsdelivr.net/npm/katex@' . $this->katex_version . '/dist/contrib/auto-render.min.js';
					break;

				default:
					$script_url = $this->githuber_plugin_url . 'assets/vendor/katex/katex.min.js';
					$auto_render_script_url = $this->githuber_plugin_url . 'assets/vendor/katex/contrib/auto-render.min.js';
					break;
			}
			wp_enqueue_script( 'katex', $script_url, array(), $this->katex_version, true );
			wp_enqueue_script( 'katex-auto-render', $auto_render_script_url, array( 'katex' ), $this->katex_version, true );
		}
	}

	/**
	 * Print Javascript plaintext in page footer.
	 */
	public function front_print_footer_scripts() {
		if ( ! $this->is_module_should_be_loaded( self::MD_POST_META_KATEX ) ) {
			return;
		}

		$script = '
			<script id="module-katex">
				if (typeof renderMathInElement !== "undefined") {
					window.githuberRenderKaTeX = window.githuberRenderKaTeX || function(element) {
						renderMathInElement(element, {
							delimiters: [
								{left: "$$", right: "$$", display: true},
								{left: "$", right: "$", display: false}
							],
							ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
							throwOnError: false
						});
					};
					var elements = document.querySelectorAll(".post, .page");
					for (var i = 0; i < elements.length; i++) {
						window.githuberRenderKaTeX(elements[i]);
					}
				}
			</script>
		';
		echo preg_replace( '/\s+/', ' ', $script );
	}

	/**
	 * Protect math expressions from Markdown backslash escaping.
	 *
	 * @param string $content Markdown content.
	 * @return array
	 */
	public static function protect_math_markup( $content ) {
		$expressions = array();
		$output      = '';
		$index       = 0;
		$length      = strlen( $content );

		while ( $index < $length ) {
			if ( '$' !== $content[ $index ] || self::is_escaped( $content, $index ) ) {
				$output .= $content[ $index ];
				$index++;
				continue;
			}

			$delimiter        = '$$' === substr( $content, $index, 2 ) ? '$$' : '$';
			$delimiter_length = strlen( $delimiter );
			$end              = $index + $delimiter_length;

			while ( $end < $length ) {
				if ( $delimiter === substr( $content, $end, $delimiter_length ) && ! self::is_escaped( $content, $end ) ) {
					break;
				}
				$end++;
			}

			if ( $end >= $length ) {
				$output .= $content[ $index ];
				$index++;
				continue;
			}

			$token         = 'GITHUBERMDMATHEXPRESSION' . count( $expressions ) . 'TOKEN';
			$expressions[] = substr( $content, $index, $end + $delimiter_length - $index );
			$output       .= $token;
			$index         = $end + $delimiter_length;
		}

		return array(
			'content'     => $output,
			'expressions' => $expressions,
		);
	}

	/**
	 * Restore protected math expressions to transformed HTML.
	 *
	 * @param string $content     Transformed HTML.
	 * @param array  $expressions Protected math expressions.
	 * @return string
	 */
	public static function restore_math_markup( $content, $expressions ) {
		foreach ( $expressions as $index => $expression ) {
			$token      = 'GITHUBERMDMATHEXPRESSION' . $index . 'TOKEN';
			$expression = htmlspecialchars( $expression, ENT_NOQUOTES, 'UTF-8' );
			$content    = str_replace( $token, $expression, $content );
		}

		return $content;
	}

	/**
	 * Check whether a character is escaped by a backslash.
	 *
	 * @param string  $content Content to inspect.
	 * @param integer $index   Character position.
	 * @return boolean
	 */
	private static function is_escaped( $content, $index ) {
		$backslashes = 0;

		while ( $index > 0 && '\\' === $content[ --$index ] ) {
			$backslashes++;
		}

		return 1 === $backslashes % 2;
	}

}
