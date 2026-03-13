; Highlights for AngelScript

; Comments
(comment) @comment

; Literals
(string_literal) @string
(number_literal) @number

; Types
(primitive_type) @type.builtin
(datatype (identifier) @type)

; Declaration names
(class_declaration name: (identifier) @type)
(interface_declaration name: (identifier) @type)
(enum_declaration name: (identifier) @type)
(typedef_declaration name: (identifier) @type)
(funcdef_declaration name: (identifier) @type)
(mixin_declaration (class_declaration name: (identifier) @type))
(base_class_list base: (identifier) @type)

; Function names
(func_declaration name: (identifier) @function)
(interface_method name: (identifier) @function)
(import_declaration name: (identifier) @function)

; Property names
(virtual_property name: (identifier) @property)

; Variable names
(variable_declaration name: (identifier) @variable)

; Parameter names
(parameter name: (identifier) @variable.parameter)

; Namespace
(namespace_declaration name: (scoped_identifier) @module)
(scoped_identifier (identifier) @module)

; Keywords
[
  "class"
  "interface"
  "enum"
  "namespace"
  "import"
  "from"
  "using"
  "typedef"
  "funcdef"
  "mixin"
  "return"
] @keyword

; Modifiers
[
  "shared"
  "abstract"
  "final"
  "external"
  "private"
  "protected"
  "const"
  "override"
  "explicit"
  "property"
  "delete"
  "in"
  "out"
  "inout"
] @keyword.modifier

; Accessor keywords
(accessor "get" @keyword)
(accessor "set" @keyword)

; Type qualifiers
"auto" @type.builtin
"void" @type.builtin

; Punctuation
["(" ")" "{" "}" "[" "]"] @punctuation.bracket
[";" "," ":" "::"] @punctuation.delimiter
["&" "@" "~" "..."] @punctuation.special

; Operators
(binary_expression operator: _ @operator)
(assignment_expression operator: _ @operator)
(unary_expression ["-" "+" "!" "~" "++" "--"] @operator)
