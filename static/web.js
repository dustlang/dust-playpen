(function () {
    "use strict";

    // For convenience of development
    var PREFIX = location.href.indexOf("/web.html") != -1 ? "https://play.rust-lang.org/" : "/";

    var samples = 2;

    function optionalLocalStorageGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch(e) {
            return null;
        }
    }

    function optionalLocalStorageSetItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch(e) {
            // ignore
        }
    }

    function build_themes(themelist) {
        // Load all ace themes, sorted by their proper name.
        var themes = themelist.themes;
        themes.sort(function (a, b) {
            if (a.caption < b.caption) {
                return -1;
            } else if (a.caption > b.caption) {
                return 1;
            }
            return 0;
        });

        var themeopt,
            themefrag = document.createDocumentFragment();
        for (var i=0; i < themes.length; i++) {
            themeopt = document.createElement("option");
            themeopt.setAttribute("val", themes[i].theme);
            themeopt.textContent = themes[i].caption;
            themefrag.appendChild(themeopt);
        }
        document.getElementById("themes").appendChild(themefrag);
    }

    function send(path, data, callback, button, message, result) {
        button.disabled = true;

        set_result(result, "<p class=message>" + message);

        var request = new XMLHttpRequest();
        request.open("POST", PREFIX + path, true);
        request.setRequestHeader("Content-Type", "application/json");
        request.onreadystatechange = function() {
            button.disabled = false;
            if (request.readyState == 4) {
                var json;

                try {
                    json = JSON.parse(request.response);
                } catch (e) {
                    console.log("JSON.parse(): " + e);
                }

                if (request.status == 200) {
                    callback(json);
                } else if (request.status === 0) {
                    set_result(result, "<p class=error>Connection failure" +
                        "<p class=error-explanation>Are you connected to the Internet?");
                } else {
                    set_result(result, "<p class=error>Something went wrong" +
                        "<p class=error-explanation>The HTTP request produced a response with status code " + request.status + ".");
                }
            }
        };
        request.timeout = 10000;
        request.ontimeout = function() {
            set_result(result, "<p class=error>Connection timed out" +
                "<p class=error-explanation>Are you connected to the Internet?");
        };
        request.send(JSON.stringify(data));
    }

    var PYGMENTS_TO_ACE_MAPPINGS = {
        'asm': {
            'c':  'ace_comment', // Comment,
            'na': 'ace_support ace_function ace_directive', // Name.Attribute,
            'no': 'ace_constant', // Name.Constant,
            'nl': 'ace_entity ace_name ace_function', // Name.Label,
            'nv': 'ace_variable ace_parameter ace_register', // Name.Variable,
            'mh': 'ace_constant ace_character ace_hexadecimal', // Number.Hex,
            'mi': 'ace_constant ace_character ace_decimal', // Number.Integer,
            'p':  'ace_punctuation', // Punctuation,
            's':  'ace_string', // String,
            'sc': 'ace_string', // String.Char,
            '':   '', // Text,
        },
        'llvm-ir': {
            'c':            'ace_comment', // Comment
            'k':            'ace_keyword', // Keyword
            'kt':           'ace_storage ace_type', // Keyword.Type
            'nl':           'ace_identifier', // Name.Label
            'nv':           'ace_variable', // Name.Variable
            'nv-Anonymous': 'ace_support ace_variable', // Name.Variable.Anonymous
            'vg':           'ace_variable ace_other', // Name.Variable.Global
            'm':            'ace_constant ace_numeric', // Number
            'p':            'ace_punctuation', // Punctuation
            's':            'ace_string', // String
            '':             '', // Text
        },
        'mir': {
            'c':            'ace_comment', // Comment
            'cm':           'ace_comment', // Comment.Multiline
            'c1':           'ace_comment', // Comment.Single
            'k':            'ace_keyword', // Keyword
            'kd':           'ace_keyword', // Keyword.Declaration
            'kt':           'ace_variable ace_language', // Keyword.Type
            'kc':           'ace_boolean', // Keyword.Constant
            'na':           'ace_constant ace_language', // Name.Attribute
            'nb':           'ace_constant ace_buildin', // Name.Builtin
            'nf':           'ace_support ace_function', // Name.Function
            'm':            'ace_constant ace_numeric', // Number
            'o':            'ace_paren', // Operator
            'p':            'ace_punctuation', // Punctuation
            's':            'ace_string', // String
            'se':           'ace_string', // String.Escape
            '':             '', // Text
        }
    };

    function rehighlight(pygmentized, language) {
        if (language == "mir") {
            pygmentized = formatMirScopes(pygmentized);
        }
        var mappings = PYGMENTS_TO_ACE_MAPPINGS[language];
        return pygmentized.replace(/<span class="([^"]*)">([^<]*)<\/span>/g, function() {
            var classes = mappings[arguments[1]];
            if (classes) {
                return '<span class="' + classes + '">' + arguments[2] + '</span>';
            } else {
                return arguments[2];
            }
        });
    }

    function redrawResult(result) {
        // Sadly the fun letter-spacing animation can leave artefacts,
        // so we want to manually trigger a redraw. It doesn???t matter
        // whether it???s relative or static for now, so we???ll flip that.
        result.parentNode.style.visibility = "hidden";
        var _ = result.parentNode.offsetHeight;  // This empty assignment is intentional
        result.parentNode.style.visibility = "";
    }

    function evaluate(result, code, version, optimize, button, test, backtrace) {
        send("evaluate.json", {code: code, version: version, optimize: optimize, test: !!test, separate_output: true, color: true, backtrace: backtrace },
            function(object) {
                var samp, pre;
                set_result(result);
                if (object.rustc) {
                    samp = document.createElement("samp");
                    samp.innerHTML = formatCompilerOutput(object.rustc);
                    pre = document.createElement("pre");
                    pre.className = "rustc-output " + (("program" in object) ? "rustc-warnings" : "rustc-errors");
                    pre.appendChild(samp);
                    result.appendChild(pre);
                }

                var div = document.createElement("p");
                div.className = "message";
                if ("program" in object) {
                    samp = document.createElement("samp");
                    samp.className = "output";
                    samp.innerHTML = formatCompilerOutput(object.program);
                    pre = document.createElement("pre");
                    pre.appendChild(samp);
                    result.appendChild(pre);
                    if (test) {
                        div = null;
                    } else {
                        div.textContent = "Program ended.";
                    }
                } else {
                    div.textContent = "Compilation failed.";
                }
                if (div) {
                    result.appendChild(div);
                }
        }, button, test ? "Running tests???" : "Running???", result);
    }

    function compile(emit, result, code, version, optimize, button, backtrace) {
        var syntax = document.getElementById('asm-flavor').value;
        send("compile.json", {emit: emit, code: code, version: version, optimize: optimize,
                              color: true, highlight: true, syntax: syntax, backtrace: backtrace}, function(object) {
            if ("error" in object) {
                set_result(result, "<pre class=\"rustc-output rustc-errors\"><samp></samp></pre>");
                result.firstChild.firstChild.innerHTML = formatCompilerOutput(object.error);
            } else {
                set_result(result, "<pre class=highlight><code>" + rehighlight(object.result, emit) + "</code></pre>");
            }
        }, button, "Compiling???", result);
    }

    function format(result, session, version, button, optimize, backtrace) {
        send("format.json", {code: session.getValue(), version: version, optimize: optimize, backtrace: backtrace}, function(object) {
            if ("error" in object) {
                set_result(result, "<pre class=highlight><samp class=rustc-errors></samp></pre>");
                result.firstChild.firstChild.innerHTML = formatCompilerOutput(object.error);
            } else {
                clear_result(result);
                session.setValue(object.result);
            }
        }, button, "Formatting???", result);
    }

    function httpRequest(method, url, data, expect, on_success, on_fail) {
        var req = new XMLHttpRequest();

        req.open(method, url, true);
        req.onreadystatechange = function() {
            if (req.readyState == XMLHttpRequest.DONE) {
                if (req.status == expect) {
                    if (on_success) {
                        on_success(req.responseText);
                    }
                } else {
                    if (on_fail) {
                        on_fail(req.status, req.responseText);
                    }
                }
            }
        };

        if (method === "GET") {
            req.send();
        } else if (method === "POST") {
            req.send(data);
        }
    }

    function repaintResult() {
        // Sadly the fun letter-spacing animation can leave artefacts in at
        // least Firefox, so we want to manually trigger a repaint. It doesn???t
        // matter whether it???s relative or static for now, so we???ll flip that.
        result.parentNode.style.visibility = "hidden";
        var _ = result.parentNode.offsetHeight;  // This empty assignment is intentional
        result.parentNode.style.visibility = "";
    }

    function shareGist(result, version, code, button, backtraceval) {
        // only needed for the "shrinking" animation
        var full_url = "https://play.rust-lang.org/?code=" + encodeURIComponent(code) +
                       "&version=" + encodeURIComponent(version) +
                       "&backtrace=" + encodeURIComponent(backtraceval);
        var url = "https://api.github.com/gists";
        button.disabled = true;

        set_result(result, "<p>Playground URL: </p><p>Gist URL: </p>");
        var link = document.createElement("a");
        link.href = link.textContent = full_url;
        link.className = "shortening-link";
        result.firstChild.appendChild(link);

        link = document.createElement("a");
        link.href = link.textContent = full_url;
        link.className = "shortening-link";
        result.lastChild.appendChild(link);

        var repainter = setInterval(repaintResult, 50);
        httpRequest("POST", "https://api.github.com/gists",
                    JSON.stringify({
                        "description": "Shared via Rust Playground",
                        "public": true,
                        "files": {
                            "playground.rs": {
                                "content": code
                            }
                        }
                    }),
                    201, // expect "Created"
                    // on success
                    function(response) {
                        button.disabled = false;
                        clearInterval(repainter);

                        response = JSON.parse(response);

                        var gist_id = response.id;
                        var gist_url = response.html_url;

                        var play_url = "https://play.rust-lang.org/?gist=" +
                                       encodeURIComponent(gist_id) + "&version=" +
                                       encodeURIComponent(version) +
                       "&backtrace=" + encodeURIComponent(backtraceval);


                        var link = result.firstChild.firstElementChild;
                        link.className = "";
                        link.href = link.textContent = play_url;

                        link = result.lastChild.firstElementChild;
                        link.className = "";
                        link.href = link.textContent = gist_url;

                        repaintResult();
                    },
                    // on fail
                    function(status, response) {
                        button.disabled = false;
                        clearInterval(repainter);

                        set_result(result, "<p class=error>Gist Creation Failed" +
                                   "<p class=error-explanation>Are you connected to the Internet?");

                        repaintResult();
                    }
        );
    }

    function share(result, version, code, button, backtraceval) {
        var playurl = "https://play.rust-lang.org/?code=" + encodeURIComponent(code);
        playurl += "&version=" + encodeURIComponent(version);
        playurl += "&backtrace=" + encodeURIComponent(backtraceval);
        if (playurl.length > 5000) {
            set_result(result, "<p class=error>Sorry, your code is too long to share this way." +
                "<p class=error-explanation>At present, sharing produces a link containing the" +
                " code in the URL, and the URL shortener used doesn???t accept URLs longer than" +
                " <strong>5000</strong> characters. Your code results in a link that is <strong>" +
                playurl.length + "</strong> characters long. Try shortening your code.");
            return;
        }

        var url = "https://is.gd/create.php?format=json&url=" + encodeURIComponent(playurl);

        button.disabled = true;

        set_result(result, "<p>Short URL: ");
        var link = document.createElement("a");
        link.href = link.textContent = playurl;
        link.className = "shortening-link";
        result.firstChild.appendChild(link);


        var repainter = setInterval(repaintResult, 50);
        httpRequest("GET", url, null, 200,
                    function(response) {
                        clearInterval(repainter);
                        button.disabled = false;

                        var link = result.firstChild.firstElementChild;
                        link.className = "";
                        link.href = link.textContent = JSON.parse(response).shorturl;

                        repaintResult();
                    },
                    function(status, response) {
                        clearInterval(repainter);
                        button.disabled = false;

                        if (request.status === 0) {
                            set_result(result, "<p class=error>Connection failure" +
                                "<p class=error-explanation>Are you connected to the Internet?");
                        } else {
                            set_result(result, "<p class=error>Something went wrong" +
                                "<p class=error-explanation>The HTTP request produced a response with status code " + status + ".");
                        }

                        repaintResult();
                    }
        );
    }

    function fetchGist(session, result, gist_id, do_evaluate, evaluateButton) {
        session.setValue("// Loading Gist: https://gist.github.com/" + gist_id + " ...");
        httpRequest("GET", "https://api.github.com/gists/" + gist_id, null, 200,
          function(response) {
              response = JSON.parse(response);
              if (response) {
                  var files = response.files;
                  for (var name in files) {
                      if (files.hasOwnProperty(name)) {
                          session.setValue(files[name].content);

                          if (do_evaluate) {
                              doEvaluate();
                          }
                          break;
                      }
                  }
              }
          },
          function(status, response) {
              set_result(result, "<p class=error>Failed to fetch Gist" +
                  "<p class=error-explanation>Are you connected to the Internet?");
          }
        );
    }

    function getQueryParameters() {
        var a = window.location.search.substr(1).split('&');
        if (a === "") return {};
        var b = {};
        for (var i = 0; i < a.length; i++) {
            var p = a[i].split('=');
            if (p.length != 2) continue;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    }

    function clear_result(result) {
        result.innerHTML = "";
        result.parentNode.setAttribute("data-empty", "");
        set_result.editor.resize();
    }

    function set_result(result, contents) {
        result.parentNode.removeAttribute("data-empty");
        if (contents === undefined) {
            result.textContent = "";
        } else if (typeof contents == "string") {
            result.innerHTML = contents;
        } else {
            result.textContent = "";
            result.appendChild(contents);
        }
        set_result.editor.resize();
    }

    function set_keyboard(editor, mode) {
        if (mode == "Emacs") {
            editor.setKeyboardHandler("ace/keyboard/emacs");
        } else if (mode == "Vim") {
            editor.setKeyboardHandler("ace/keyboard/vim");
            if (!set_keyboard.vim_set_up) {
                ace.config.loadModule("ace/keyboard/vim", function(m) {
                    var Vim = ace.require("ace/keyboard/vim").CodeMirror.Vim;
                    Vim.defineEx("write", "w", function(cm, input) {
                        cm.ace.execCommand("evaluate");
                    });
                });
            }
            set_keyboard.vim_set_up = true;
        } else {
            editor.setKeyboardHandler(null);
        }
    }

    function set_theme(editor, themelist, theme) {
        var themes = document.getElementById("themes");
        var themepath = null,
            i = 0,
            themelen = themelist.themes.length,
            selected = themes.options[themes.selectedIndex];
        if (selected.textContent === theme) {
            themepath = selected.getAttribute("val");
        } else {
            for (i; i < themelen; i++) {
                if (themelist.themes[i].caption == theme) {
                    themes.selectedIndex = i;
                    themepath = themelist.themes[i].theme;
                    break;
                }
            }
        }
        if (themepath !== null) {
            editor.setTheme(themepath);
            optionalLocalStorageSetItem("theme", theme);
        }
    }

    function getRadioValue(name) {
        var nodes = document.getElementsByName(name);
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.checked) {
                return node.value;
            }
        }
    }

    var evaluateButton;
    var asmButton;
    var irButton;
    var mirButton;
    var formatButton;
    var shareButton;
    var gistButton;
    var configureEditorButton;
    var result;
    var clearResultButton;
    var keyboard;
    var themes;
    var editor;
    var session;
    var themelist;
    var evaluateAction = "run";
    var theme;
    var mode;
    var query;
    var asm_flavor;
    var backtrace;

    function updateEvaluateAction(code) {
        // A very simple pair of heuristics; there???s no point in doing more, IMO.
        if (code.indexOf("fn main()") === -1 && code.indexOf("#[test]") !== -1) {
            evaluateButton.textContent = "Test";
            evaluateAction = "test";
        } else {
            evaluateButton.textContent = "Run";
            evaluateAction = "run";
        }
    }

    function doEvaluate(skipActionGuessing) {
        var code = session.getValue();
        if (!skipActionGuessing) {
            // If we have called this since the last change in the editor,
            // this would be a waste of time
            updateEvaluateAction(code);
        }
        evaluate(result, session.getValue(), getRadioValue("version"),
                 getRadioValue("optimize"), evaluateButton,
                 evaluateAction === "test",
                 backtrace.value);
    }

    var COLOR_CODES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

    // A simple function to decode ANSI escape codes into HTML.
    // This is very basic, with lots of very obvious omissions and holes;
    // it???s designed purely to cope with rustc output.
    //
    // TERM=xterm rustc uses these:
    //
    // - bug/fatal/error = red
    // - warning = yellow
    // - note = green
    // - help = cyan
    // - error code = magenta
    // - bold
    function ansi2html(text) {
        return text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\x1b\[1m\x1b\[3([0-7])m([^\x1b]*)(?:\x1b\(B)?\x1b\[0?m/g, function(original, colorCode, text) {
                return '<span class=ansi-' + COLOR_CODES[+colorCode] + '><strong>' + text + '</strong></span>';
            }).replace(/\x1b\[3([0-7])m([^\x1b]*)(?:\x1b\(B)?\x1b\[0?m/g, function(original, colorCode, text) {
                return '<span class=ansi-' + COLOR_CODES[+colorCode] + '>' + text + '</span>';
            }).replace(/\x1b\[1m([^\x1b]*)(?:\x1b\(B)?\x1b\[0?m/g, function(original, text) {
                return "<strong>" + text + "</strong>";
            }).replace(/(?:\x1b\(B)?\x1b\[0?m/g, '');
    }

    //This affects how mouse acts on the program output.
    //Screenshots here: https://github.com/rust-lang/rust-playpen/pull/192#issue-145465630
    //If mouse hovers on eg. "<anon>:3", temporarily show that line(3) into view by
    //selecting it entirely and move editor's cursor to the beginning of it;
    //Moves back to original view when mouse moved away.
    //If mouse left click on eg. "<anon>:3" then the editor's cursor is moved
    //to the beginning of that line
    function jumpToLine(text, r1) {
        return "<a onclick=\"javascript:editGo(" + r1 + ",1)\"" +
            " onmouseover=\"javascript:editShowLine("+r1+")\"" +
            " onmouseout=\"javascript:editRestore()\"" +
            " class=\"linejump\">" + text + "</a>";
    }

    //Similarly to jumpToLine, except this one acts on eg. "<anon>:2:31: 2:32"
    //and thus selects a region on mouse hover, or when clicked sets cursor to
    //the beginning of region.
    function jumpToRegion(text, r1,c1, r2,c2) {
        return "<a onclick=\"javascript:editGo("+r1+","+c1+")\"" +
            " onmouseover=\"javascript:editShowRegion("+r1+","+c1+", "+r2+","+c2+")\"" +
            " onmouseout=\"javascript:editRestore()\"" +
            " class=\"linejump\">" + text + "</a>";
    }

    //Similarly to jumpToLine, except this one acts on eg. "<anon>:2:31"
    function jumpToPoint(text, r1,c1) {
        return "<a onclick=\"javascript:editGo("+r1+","+c1+")\"" +
            " onmouseover=\"javascript:editShowPoint("+r1+","+c1+")\"" +
            " onmouseout=\"javascript:editRestore()\"" +
            " class=\"linejump\">" + text + "</a>";
    }

    function formatCompilerOutput(text) {
        return ansi2html(text).replace(/\[(--explain )?(E\d\d\d\d)\]/g, function(text, prefix, code) {
            return "[<a href=https://doc.rust-lang.org/error-index.html#" + code + " target=_blank>" + (prefix ? prefix : "") + code + "</a>]";
        }).replace(/run `rustc --explain (E\d\d\d\d)` to see a detailed explanation/g, function(text, code) {
            return "see the <a href=https://doc.rust-lang.org/error-index.html#" + code + " target=_blank>detailed explanation for " + code + "</a>";
        }).replace(/&lt;anon&gt;:(\d+)$/mg, jumpToLine) // panicked at 'foo', $&
        .replace(/^&lt;anon&gt;:(\d+):(\d+):\s+(\d+):(\d+)/mg, jumpToRegion)
        .replace(/^&lt;anon&gt;:(\d+)/mg, jumpToLine)
        .replace(/&lt;anon&gt;:(\d+):(\d+)/mg, jumpToPoint);  // new errors
    }

    function formatMirScopes(text) {
        return text.replace(/&lt;anon&gt;:(\d+):(\d+):\s+(\d+):(\d+)/mg, jumpToRegion);
    }

    addEventListener("DOMContentLoaded", function() {
        evaluateButton = document.getElementById("evaluate");
        asmButton = document.getElementById("asm");
        irButton = document.getElementById("llvm-ir");
        mirButton = document.getElementById("mir");
        formatButton = document.getElementById("format");
        shareButton = document.getElementById("share");
        gistButton = document.getElementById("gist");
        configureEditorButton = document.getElementById("configure-editor");
        result = document.getElementById("result").firstChild;
        clearResultButton = document.getElementById("clear-result");
        keyboard = document.getElementById("keyboard");
        asm_flavor = document.getElementById("asm-flavor");
        backtrace = document.getElementById("backtrace");
        themes = document.getElementById("themes");
        editor = ace.edit("editor");
        set_result.editor = editor;
        editor.$blockScrolling = Infinity;
        editor.setAnimatedScroll(true);
        session = editor.getSession();
        themelist = ace.require("ace/ext/themelist");

        editor.focus();

        build_themes(themelist);

        editor.renderer.on('themeChange', function(e) {
            var path = e.theme;
            ace.config.loadModule(['theme', e.theme], function(t) {
                document.getElementById("result").className = t.cssClass + (t.isDark ? " ace_dark" : "");
            });
        });

        theme = optionalLocalStorageGetItem("theme");
        if (theme === null) {
            set_theme(editor, themelist, "GitHub");
        } else {
            set_theme(editor, themelist, theme);
        }

        session.setMode("ace/mode/rust");

        mode = optionalLocalStorageGetItem("keyboard");
        if (mode !== null) {
            set_keyboard(editor, mode);
            keyboard.value = mode;
        }

        var flavor = optionalLocalStorageGetItem("asm_flavor");
        if (flavor !== null) {
            asm_flavor.value = flavor;
        }

        var vbacktrace = optionalLocalStorageGetItem("backtrace");
        if (vbacktrace !== null) {
            backtrace.value = vbacktrace;
        }

        query = getQueryParameters();
        if ("code" in query) {
            session.setValue(query.code);
        } else if ("gist" in query) {
            // fetchGist() must defer evaluation until after the content has been loaded
            fetchGist(session, result, query.gist, query.run === "1", evaluateButton);
            query.run = 0;
        } else {
            var code = optionalLocalStorageGetItem("code");
            if (code !== null) {
                session.setValue(code);
            }
        }

        if ("version" in query) {
            var radio = document.getElementById("version-" + query.version);
            if (radio !== null) {
                radio.checked = true;
            }
        }

        if ("backtrace" in query) {
            if (backtrace !== null) {
                backtrace.value = query.backtrace;
            }
        }

        if (query.run === "1") {
            doEvaluate();
        } else {
            updateEvaluateAction(session.getValue());
        }

        addEventListener("resize", function() {
            editor.resize();
        });

        //This helps re-focus editor after a Run or any other action that caused
        //editor to lose focus. Just press Enter or Esc key to focus editor.
        //Without this, you'd most likely have to LMB somewhere in the editor
        //area which would change the location of its cursor to where you clicked.
        addEventListener("keyup", function(e) {
            if ((document.body == document.activeElement) && //needed to avoid when editor has focus already
                (13 == e.keyCode || 27 == e.keyCode)) { //Enter or Escape keys
                editor.focus();
            }
        });

        session.on("change", function() {
            var code = session.getValue();
            optionalLocalStorageSetItem("code", code);
            updateEvaluateAction(code);
        });

        keyboard.onkeyup = keyboard.onchange = function() {
            var mode = keyboard.options[keyboard.selectedIndex].value;
            optionalLocalStorageSetItem("keyboard", mode);
            set_keyboard(editor, mode);
        };

        asm_flavor.onkeyup = asm_flavor.onchange = function() {
            var flavor = asm_flavor.options[asm_flavor.selectedIndex].value;
            optionalLocalStorageSetItem("asm_flavor", flavor);
        };

        backtrace.onkeyup = backtrace.onchange = function() {
            var vbacktrace = backtrace.options[backtrace.selectedIndex].value;
            optionalLocalStorageSetItem("backtrace", vbacktrace);
        };

        evaluateButton.onclick = function() {
            doEvaluate(true);
            editor.focus();
        };

        editor.commands.addCommand({
            name: "evaluate",
            exec: evaluateButton.onclick,
            bindKey: {win: "Ctrl-Enter", mac: "Ctrl-Enter"}
        });

        // ACE uses the "cstyle" behaviour for all languages by default, which
        // gives us nice things like quote and paren autopairing. However this
        // also autopairs single quotes, which makes writing lifetimes annoying.
        // To avoid having to duplicate the other functionality provided by the
        // cstyle behaviour, we work around this situation by hijacking the
        // single quote as a hotkey and modifying the document ourselves, which
        // does not trigger this behaviour.
        editor.commands.addCommand({
            name: "rust_no_single_quote_autopairing",
            exec: function(editor, line) {
                var sess = editor.getSession();
                var doc = sess.getDocument();
                var selection = sess.getSelection();
                var ranges = selection.getAllRanges();
                var prev_range = null;

                // no selection = zero width range, so we don't need to handle this case specially
                // start from the back, so changes to earlier ranges don't invalidate later ranges
                for (var i = ranges.length - 1; i >= 0; i--) {
                    // sanity check: better to do no modification than to do something wrong
                    // see the compareRange docs:
                    // https://github.com/ajaxorg/ace/blob/v1.2.6/lib/ace/range.js#L106-L120
                    if (prev_range && prev_range.compareRange(ranges[i]) != -2) {
                        console.log("ranges intersect or are not in ascending order, skipping",
                                    ranges[i]);
                    }
                    prev_range = ranges[i];

                    doc.replace(ranges[i], "'");
                }
                // the selection contents were replaced, so clear the selection
                selection.clearSelection();
            },
            bindKey: {win: "'", mac: "'"},
        });

        // We???re all pretty much agreed that such an obscure command as transposing
        // letters hogging Ctrl-T, normally ???open new tab???, is a bad thing.
        var transposeletters = editor.commands.commands.transposeletters;
        editor.commands.removeCommand("transposeletters");
        delete transposeletters.bindKey;
        editor.commands.addCommand(transposeletters);

        asmButton.onclick = function() {
            compile("asm", result, session.getValue(), getRadioValue("version"),
                     getRadioValue("optimize"), asmButton, backtrace.value);
        };

        irButton.onclick = function() {
            compile("llvm-ir", result, session.getValue(), getRadioValue("version"),
                     getRadioValue("optimize"), irButton, backtrace.value);
        };

        mirButton.onclick = function() {
            document.getElementById("version-nightly").checked = true;
            compile("mir", result, session.getValue(), getRadioValue("version"),
                     getRadioValue("optimize"), mirButton, backtrace.value);
        };

        formatButton.onclick = function() {
            format(result, session, getRadioValue("version"), formatButton,
                   getRadioValue("optimize"), backtrace.value);
        };

        shareButton.onclick = function() {
            share(result, getRadioValue("version"), session.getValue(), shareButton, backtrace.value);
        };

        gistButton.onclick = function() {
            shareGist(result, getRadioValue("version"), session.getValue(), gistButton, backtrace.value);
        };

        configureEditorButton.onclick = function() {
            var dropdown = configureEditorButton.nextElementSibling;
            dropdown.style.display = dropdown.style.display ? "" : "block";
        };

        clearResultButton.onclick = function() {
            clear_result(result);
        };

        themes.onkeyup = themes.onchange = function () {
            set_theme(editor, themelist, themes.options[themes.selectedIndex].text);
        };

    }, false);
}());


// called via javascript:fn events from formatCompilerOutput
var old_range;

function editorGet() {
    return window.ace.edit("editor");
}

function editGo(r1,c1) {
    var e = editorGet();
    old_range = undefined;
    e.focus();
    e.selection.clearSelection();
    e.scrollToLine(r1-1, true, true);
    e.selection.moveCursorTo(r1-1, c1-1, false);
}

function editRestore() {
    if (old_range) {
        var e = editorGet();
        e.selection.setSelectionRange(old_range, false);
        var mid = (e.getFirstVisibleRow() + e.getLastVisibleRow()) / 2;
        var intmid = Math.round(mid);
        var extra = (intmid - mid)*2 + 2;
        var up = e.getFirstVisibleRow() - old_range.start.row + extra;
        var down = old_range.end.row - e.getLastVisibleRow() + extra;
        if (up > 0) {
            e.scrollToLine(mid - up, true, true);
        } else if (down > 0) {
            e.scrollToLine(mid + down, true, true);
        } // else visible enough
    }
}

function editShowRegion(r1,c1, r2,c2) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(Math.round((r1 + r2) / 2), true, true);
    es.setSelectionAnchor(r1-1, c1-1);
    es.selectTo(r2-1, c2-1);
}

function editShowLine(r1) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(r1, true, true);
    es.moveCursorTo(r1-1, 0);
    es.moveCursorLineEnd();
    es.selectTo(r1-1, 0);
}

function editShowPoint(r1,c1) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(r1, true, true);
    es.moveCursorTo(r1-1, 0);
    es.moveCursorLineEnd();
    es.selectTo(r1-1, c1-1);
}
