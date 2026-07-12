

var global_editormd_config = {};
var wp_editor_container = '#wp-content-editor-container';
var wp_editor = 'wp-content-editor-container';
var githuber_md_editor;
var is_support_inline_keyboard_style = false;
var is_support_html_figure = false;
var spellcheck_dictionary_dir = '';
var spellcheck_lang = 'en_US';

function githuber_md_protect_math(markdown) {
    var expressions = [];
    var output = '';
    var index = 0;

    while (index < markdown.length) {
        var delimiter = markdown.substr(index, 2) === '$$' ? '$$' : '$';

        if (markdown.charAt(index) !== '$' || githuber_md_is_escaped(markdown, index)) {
            output += markdown.charAt(index++);
            continue;
        }

        var end = index + delimiter.length;
        while (end < markdown.length) {
            if (markdown.substr(end, delimiter.length) === delimiter && !githuber_md_is_escaped(markdown, end)) {
                break;
            }
            end++;
        }

        if (end >= markdown.length) {
            output += markdown.charAt(index++);
            continue;
        }

        var token = 'GITHUBERMDMATHEXPRESSION' + expressions.length + 'TOKEN';
        expressions.push(markdown.substring(index, end + delimiter.length));
        output += token;
        index = end + delimiter.length;
    }

    return {markdown: output, expressions: expressions};
}

function githuber_md_is_escaped(text, index) {
    var backslashes = 0;
    while (index > 0 && text.charAt(--index) === '\\') {
        backslashes++;
    }
    return backslashes % 2 === 1;
}

function githuber_md_restore_math(html, expressions) {
    expressions.forEach(function(expression, index) {
        var token = 'GITHUBERMDMATHEXPRESSION' + index + 'TOKEN';
        var escapedExpression = expression
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        html = html.split(token).join(escapedExpression);
    });

    return html;
}

function githuber_md_render_katex(container) {
    if (typeof renderMathInElement === 'undefined' || typeof container === 'undefined' || !container) {
        return;
    }

    renderMathInElement(container, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        throwOnError: false
    });
}

(function($) {
    $(function() {
        var config = window.editormd_config;

        spellcheck_lang = config.editor_spell_check_lang;
        spellcheck_dictionary_dir = 'https://spellcheck-dictionaries.github.io/' + spellcheck_lang + '/';

        is_support_inline_keyboard_style = (config.support_inline_code_keyboard_style === 'yes');
        is_support_html_figure = (config.support_html_figure === 'yes');

        if (config.support_katex === 'yes' && typeof editormd !== 'undefined') {
            editormd.loadKaTeX = function(callback) {
                var loadPath = config.editor_modules_url;
                callback = callback || function() {};

                editormd.loadCSS(loadPath + '../../katex/katex.min', function() {
                    editormd.loadScript(loadPath + '../../katex/katex.min', function() {
                        editormd.loadScript(loadPath + '../../katex/contrib/auto-render.min', function() {
                            callback();

                            if (typeof githuber_md_editor !== 'undefined' && githuber_md_editor.previewContainer) {
                                githuber_md_render_katex(githuber_md_editor.previewContainer[0]);
                            }
                        });
                    });
                });
            };

        }

        global_editormd_config = {
            width: '100%',
            height: 640,
            path: config.editor_modules_url,
            placeholder: config.placeholder,
            syncScrolling: (config.editor_sync_scrolling === 'yes'),
            watch: (config.editor_live_preview === 'yes'),
            htmlDecode: (config.editor_html_decode === 'yes'),
            theme: config.editor_toolbar_theme, 
            previewTheme: 'default',
            editorTheme: config.editor_editor_theme, 
            tocContainer: (config.support_toc === 'yes') ? '' : false,
            emoji: (config.support_emojify === 'yes'),
            tex: (config.support_katex === 'yes'),
            texAutoRender: (config.support_katex === 'yes'),
            mathJax: (config.support_mathjax === 'yes'),
            flowChart: (config.support_flowchart === 'yes'),
            sequenceDiagram: (config.support_sequence_diagram === 'yes'),
            taskList: (config.support_task_list === 'yes'),
            mermaid: (config.support_mermaid === 'yes'),
            lineNumbers: (config.editor_line_number === 'yes'),
            previewCodeLineNumber: (config.prism_line_number === 'yes'),
            spellCheck: (config.editor_spell_check === 'yes'),
            matchWordHighlight: (config.editor_match_highlighter === 'yes') ? 'onselected' : false,
            toolbarAutoFixed: true,
            tocm: false, 
            tocDropdown: false,    
            atLink: false,
            imagePasteCallback: config.image_paste_callback,
            toolbarIcons: function () {
                return [
                    'undo', 'redo', '|',
                    'bold', 'del', 'italic', 'quote', '|',
                    'h1', 'h2', 'h3', 'h4', '|',
                    'list-ul', 'list-ol', 'hr', '|',
                    'link', 'reference-link', 'image', 'code', 'code-block', 'table', 'datetime', 'html-entities', 'more', 'pagebreak', config.support_emoji === 'yes' ? 'emoji' : '' + '|',
                    'watch', 'preview', 'fullscreen',  config.support_emojify === 'yes' ? "emoji" : "", 'help', 
                ];
            },
            onfullscreen: function () {
                $(wp_editor_container).css({
                    'position': 'fixed',
                    'z-index': '99999'
                })
            },

            onfullscreenExit: function () {
                $(wp_editor_container).css({
                    'position': 'relative',
                    'z-index': 'auto'
                });
                reload_githuber_md();
            },

            onload: function() {
                githuber_md_render_katex(this.previewContainer[0]);
            },

            onchange: function() {
                githuber_md_render_katex(this.previewContainer[0]);
            },

            onpreviewing: function() {
                githuber_md_render_katex(this.previewContainer[0]);
            },

            toolbarIconsClass: {
                toc: 'fa-list-alt',
                more: 'fa-ellipsis-h'
            },

            toolbarHandlers: {
                toc: function (cm, icon, cursor, selection) {
                    cm.replaceSelection('[toc]');
                },
                more: function (cm, icon, cursor, selection) {
                    cm.replaceSelection('\r\n<!--more-->\r\n');
                }
            },
            lang: {
                toolbar: {
                    toc: 'The Table Of Contents',
                    more: 'More'
                }
            },
        };


        if ($(wp_editor_container).length === 1) {
            githuber_md_editor = editormd(wp_editor, global_editormd_config);
        }

        function reload_githuber_md() {
            //  githuber_md_editor = editormd(wp_editor, global_editormd_config);
        }

        if (typeof image_insert_type !== 'undefined') {
            var image_insert_type = 'markdown';
        }
        $(document).on('change', '.githuber_image_insert', function() {
            // html or markdown
            image_insert_type = $(this).val();
        });

        /*
            $(document).ajaxSuccess(function(event, xhr, settings, data) {
                if (settings.url.indexOf('/wp-admin/admin-ajax.php') !== -1 && typeof data.data !== 'undefined') {
                    if (data.success && typeof data.data === 'string') {

                    }
                }
            });
        */

        wp.media.editor.insert = function (html_str) {
            //console.log(html_str);
            var new_content = '';

            if (html_str.substring(0, 4) === '<img') {
    
                var img_src = $(html_str).attr('src');
                var img_alt = $(html_str).attr('alt');

                if (image_insert_type === 'html') {
                    new_content += html_str;
                } else {
                    new_content += '![' + img_alt + '](' + img_src + ')';
                }

                githuber_md_editor.replaceSelection(new_content);
                image_insert_type = 'markdown';

            } else if (html_str.substring(0, 7) === '<a href' && -1 !== html_str.indexOf('<img')) {

                var a_href = $(html_str).attr('href');
                var img_src = $(html_str).find('img').attr('src');
                var img_alt = $(html_str).find('img').attr('alt');

                if (image_insert_type === 'html') {
                    new_content += html_str;
                } else {
                    new_content += '[![' + img_alt + '](' + img_src + ')](' + a_href + ')';
                }
                githuber_md_editor.replaceSelection(new_content);
                image_insert_type = 'markdown';
            } else if (html_str.substring(0, 1) === '[' && html_str.slice(-1) === ']') {
                new_content += html_str;
                githuber_md_editor.replaceSelection(new_content);
            } else if ((html_str.substring(0, 7) === '<a href')) {
                var ahref = $(html_str).attr('href');
                var inicio_txt = html_str.indexOf('>');
                var fin_txt = html_str.indexOf('<', inicio_txt);
                var txt = html_str.substring(inicio_txt+1, fin_txt);
                if (image_insert_type === 'html') {
                    new_content += html_str;
                } else {
                    new_content += '[' + txt + '](' + ahref +' "' + txt +'")';
                }
                githuber_md_editor.replaceSelection(new_content);
            } else {
                console.log(html_str);
            }
        }
    });
})(jQuery);


