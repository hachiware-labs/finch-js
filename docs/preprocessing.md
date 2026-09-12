# Reusable diagram source

Enable preprocessing with `Finch.render(source, { target: '#diagram', preprocess: {} })`. It works before parsing every diagram kind while retaining the original editable source.

[Editable example](../examples/reusable-sequence.html) · [Complete reference in Japanese](preprocessing_ja.md)

| Capability | Syntax |
|---|---|
| Variables | `!define NAME value`, `!let N = expression`, `{{NAME}}`, `!undef NAME` |
| Conditions | `!if expression`, `!elseif`, `!else`, `!endif` |
| Assertions | `!assert N > 0 : "N must be positive"` |
| Reusable source | `!procedure name(args)` … `!endprocedure`, `!call name(JSON arguments)` |
| Return values | `!function name(args)` … `!return expression` … `!endfunction` |
| Iteration | `!foreach ID in ["api","worker"]` … `!endfor`; `!while expression` … `!endwhile` |
| Includes | `!include "name"` |

Functions support expressions, defaults and early returns. Procedure and function locals are restored after calls. A foreach iteration variable is restored after its loop; other assignments persist. Functions return strings, finite numbers or booleans and cannot emit diagram lines. Use `!let RESULT = function(...)`, then `{{RESULT}}` in labels.

Builtins: `upper`, `lower`, `trim`, `strlen`, `substr`, `strpos`, `replace`, `concat`, `string`, `number`, `abs`, `floor`, `ceil`, `round`, `min`, `max`, `exists`. String positions count Unicode code points. `substr(text,start,length?)` is zero-based; `strpos` returns -1 when absent. Replacement is literal. `+` is numeric addition; use `concat` for strings.

Pass `definitions`, an `includes` name-to-source map, or a synchronous `resolveInclude(name, from)` loader through the preprocessing options. Missing resources are errors. Only selected branches load resources. No implicit network or host-code execution occurs.

Each source update shares one include snapshot across validation, rendering and HTML saving. Theme/layout changes reuse it. Call `instance.update(source)` to reload changed external resources. Invalid updated source preserves the last valid document. Saved HTML contains the source and resolved dependencies; Markdown contains expanded source. Dependencies from unvisited branches may require a loader again when editing a restored document.

For async loading, import `snapshotPreprocessAsync` and `restorePreprocess` from the module. Await a snapshot with an async loader, then render the original source using `preprocess: restorePreprocess(result.snapshot)`. `preprocessAsync` returns expanded text only. Cancellation detection accepts an AbortSignal; also pass it to your fetch implementation to abort transport.

Delimiter checks include unreachable return tails. Limits are 32 include levels, 32 combined function/procedure calls, 32 nested loops, 10000 iterations per loop, 100000 processed lines and 1000 asynchronous resources. JSON object iteration, loop break/continue, definitions inside loops and the complete PlantUML builtin/standard library remain outside the current implementation. Finch syntax is not PlantUML source compatibility.
