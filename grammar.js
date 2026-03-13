/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

/**
 * @param {RuleOrLiteral} rule
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

module.exports = grammar({
  name: "angelscript",

  extras: $ => [
    /\s+/,
    $.comment,
  ],

  word: $ => $.identifier,

  conflicts: $ => [
    // shared/external prefix ambiguity across top-level declarations
    [$.func_declaration, $.class_declaration, $.enum_declaration, $.interface_declaration, $.funcdef_declaration],
    // shared/external prefix inside class body (func vs funcdef)
    [$.func_declaration, $.funcdef_declaration],
    // argument_list vs parameter_list: both match '(' ... ')'
    [$.parameter_list, $.argument_list],
    // identifier in argument/parameter context can be expression or type
    [$.datatype, $._expression],
  ],

  rules: {
    // =========================================================================
    // SCRIPT (top-level)
    // =========================================================================
    script: $ => repeat(choice(
      $.import_declaration,
      $.enum_declaration,
      $.typedef_declaration,
      $.class_declaration,
      $.mixin_declaration,
      $.interface_declaration,
      $.funcdef_declaration,
      $.virtual_property,
      $.variable_declaration,
      $.func_declaration,
      $.namespace_declaration,
      $.using_declaration,
      ";",
    )),

    // =========================================================================
    // IMPORT
    // =========================================================================
    import_declaration: $ => seq(
      "import",
      field("return_type", $.type),
      optional("&"),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional($.func_attributes),
      "from",
      field("source", $.string_literal),
      ";",
    ),

    // =========================================================================
    // USING
    // =========================================================================
    using_declaration: $ => seq(
      "using",
      "namespace",
      $.scoped_identifier,
      ";",
    ),

    scoped_identifier: $ => seq(
      $.identifier,
      repeat(seq("::", $.identifier)),
    ),

    // =========================================================================
    // NAMESPACE
    // =========================================================================
    namespace_declaration: $ => seq(
      "namespace",
      field("name", $.scoped_identifier),
      field("body", $.namespace_body),
    ),

    namespace_body: $ => seq(
      "{",
      repeat(choice(
        $.import_declaration,
        $.enum_declaration,
        $.typedef_declaration,
        $.class_declaration,
        $.mixin_declaration,
        $.interface_declaration,
        $.funcdef_declaration,
        $.virtual_property,
        $.variable_declaration,
        $.func_declaration,
        $.namespace_declaration,
        $.using_declaration,
        ";",
      )),
      "}",
    ),

    // =========================================================================
    // ENUM
    // =========================================================================
    enum_declaration: $ => seq(
      repeat(choice("shared", "external")),
      "enum",
      field("name", $.identifier),
      choice(
        ";",
        seq(
          "{",
          commaSep($.enum_member),
          optional(","),
          "}",
        ),
      ),
    ),

    enum_member: $ => seq(
      field("name", $.identifier),
      optional(seq("=", field("value", $._expression))),
    ),

    // =========================================================================
    // TYPEDEF
    // =========================================================================
    typedef_declaration: $ => seq(
      "typedef",
      field("base_type", $.primitive_type),
      field("name", $.identifier),
      ";",
    ),

    // =========================================================================
    // CLASS
    // =========================================================================
    class_declaration: $ => seq(
      repeat(choice("shared", "abstract", "final", "external")),
      "class",
      field("name", $.identifier),
      choice(
        ";",
        seq(
          optional($.base_class_list),
          field("body", $.class_body),
        ),
      ),
    ),

    base_class_list: $ => seq(
      ":",
      commaSep1(field("base", $.identifier)),
    ),

    class_body: $ => seq(
      "{",
      repeat(choice(
        $.virtual_property,
        $.func_declaration,
        $.variable_declaration,
        $.funcdef_declaration,
      )),
      "}",
    ),

    // =========================================================================
    // MIXIN
    // =========================================================================
    mixin_declaration: $ => seq(
      "mixin",
      $.class_declaration,
    ),

    // =========================================================================
    // INTERFACE
    // =========================================================================
    interface_declaration: $ => seq(
      repeat(choice("external", "shared")),
      "interface",
      field("name", $.identifier),
      choice(
        ";",
        seq(
          optional($.base_class_list),
          field("body", $.interface_body),
        ),
      ),
    ),

    interface_body: $ => seq(
      "{",
      repeat(choice(
        $.virtual_property,
        $.interface_method,
      )),
      "}",
    ),

    interface_method: $ => seq(
      field("return_type", $.type),
      optional("&"),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional("const"),
      ";",
    ),

    // =========================================================================
    // FUNCDEF
    // =========================================================================
    funcdef_declaration: $ => seq(
      repeat(choice("external", "shared")),
      "funcdef",
      field("return_type", $.type),
      optional("&"),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      ";",
    ),

    // =========================================================================
    // FUNC
    // =========================================================================
    func_declaration: $ => prec.dynamic(2, seq(
      repeat(choice("shared", "external")),
      optional(choice("private", "protected")),
      optional(
        choice(
          seq(field("return_type", $.type), optional("&")),
          "~",
        ),
      ),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional("const"),
      optional($.func_attributes),
      choice(";", field("body", $.statement_block)),
    )),

    func_attributes: _ => repeat1(
      choice("override", "final", "explicit", "property", "delete"),
    ),

    // =========================================================================
    // VIRTUAL PROPERTY
    // =========================================================================
    virtual_property: $ => prec.dynamic(3, seq(
      optional(choice("private", "protected")),
      field("prop_type", $.type),
      optional("&"),
      field("name", $.identifier),
      "{",
      repeat($.accessor),
      "}",
    )),

    accessor: $ => seq(
      field("kind", choice("get", "set")),
      optional("const"),
      optional($.func_attributes),
      choice(";", field("body", $.statement_block)),
    ),

    // =========================================================================
    // VAR (single declarator; multi-declarator deferred to Step 6)
    // =========================================================================
    variable_declaration: $ => prec.dynamic(1, seq(
      optional(choice("private", "protected")),
      field("var_type", $.type),
      field("name", $.identifier),
      optional(choice(
        seq("=", choice($.initializer_list, $._expression)),
        $.argument_list,
      )),
      ";",
    )),

    // =========================================================================
    // STATEMENT BLOCK (stub — expanded in Step 3)
    // =========================================================================
    statement_block: $ => seq(
      "{",
      repeat(choice(
        $.variable_declaration,
        $._statement,
        $.using_declaration,
      )),
      "}",
    ),

    _statement: $ => choice(
      $.if_statement,
      $.for_statement,
      $.foreach_statement,
      $.while_statement,
      $.do_while_statement,
      $.switch_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.try_statement,
      $.statement_block,
      $.expression_statement,
      ";",
    ),

    expression_statement: $ => seq(
      $._expression,
      ";",
    ),

    return_statement: $ => seq(
      "return",
      optional($._expression),
      ";",
    ),

    // =========================================================================
    // CONTROL FLOW STATEMENTS
    // =========================================================================

    // prec.right resolves dangling-else: else binds to innermost if
    if_statement: $ => prec.right(seq(
      "if", "(", $._expression, ")",
      field("consequence", $._statement),
      optional(seq("else", field("alternative", $._statement))),
    )),

    for_statement: $ => seq(
      "for", "(",
      field("init", choice($.variable_declaration, $.expression_statement, ";")),
      field("condition", choice($.expression_statement, ";")),
      field("update", optional(commaSep1($._expression))),
      ")",
      field("body", $._statement),
    ),

    foreach_statement: $ => seq(
      "foreach", "(",
      commaSep1($.foreach_variable),
      ":",
      field("collection", $._expression),
      ")",
      field("body", $._statement),
    ),

    foreach_variable: $ => seq(
      field("type", $.type),
      field("name", $.identifier),
    ),

    while_statement: $ => seq(
      "while", "(", $._expression, ")",
      field("body", $._statement),
    ),

    do_while_statement: $ => seq(
      "do",
      field("body", $._statement),
      "while", "(", $._expression, ")", ";",
    ),

    switch_statement: $ => seq(
      "switch", "(", $._expression, ")",
      "{", repeat($.case_clause), "}",
    ),

    case_clause: $ => seq(
      choice(seq("case", $._expression), "default"),
      ":",
      repeat(choice($.variable_declaration, $._statement)),
    ),

    break_statement: _ => seq("break", ";"),

    continue_statement: _ => seq("continue", ";"),

    try_statement: $ => seq(
      "try", $.statement_block,
      "catch", $.statement_block,
    ),

    // =========================================================================
    // PARAMETER LIST
    // =========================================================================
    parameter_list: $ => seq(
      "(",
      optional(commaSep1($.parameter)),
      ")",
    ),

    parameter: $ => seq(
      field("param_type", $.type),
      optional(seq("&", optional(choice("in", "out", "inout")))),
      choice(
        "...",
        seq(
          optional(field("name", $.identifier)),
          optional(seq("=", field("default_value", $._expression))),
        ),
      ),
    ),

    // =========================================================================
    // TYPE SYSTEM
    // =========================================================================
    type: $ => seq(
      optional("const"),
      optional($.scope),
      $.datatype,
      repeat(choice(
        seq("[", "]"),
        seq("@", optional("const")),
      )),
    ),

    scope: $ => prec.left(choice(
      "::",
      seq(optional("::"), repeat1(seq($.identifier, "::"))),
    )),

    datatype: $ => choice(
      $.identifier,
      $.primitive_type,
      "?",
      "auto",
    ),

    // =========================================================================
    // EXPRESSION (minimal placeholder — Step 4 expands fully)
    // =========================================================================
    _expression: $ => choice(
      $.assignment_expression,
      $.binary_expression,
      $.unary_expression,
      $.postfix_expression,
      $.call_expression,
      $.member_expression,
      $.parenthesized_expression,
      $.number_literal,
      $.string_literal,
      $.boolean_literal,
      $.null_literal,
      $.identifier,
    ),

    parenthesized_expression: $ => seq("(", $._expression, ")"),

    call_expression: $ => prec(16, seq(
      field("function", $._expression),
      field("arguments", $.argument_list),
    )),

    member_expression: $ => prec.left(16, seq(
      field("object", $._expression),
      ".",
      field("member", $.identifier),
    )),

    postfix_expression: $ => prec.left(16, seq(
      $._expression,
      choice("++", "--"),
    )),

    unary_expression: $ => prec.right(15, seq(
      choice("-", "+", "!", "~", "++", "--"),
      $._expression,
    )),

    binary_expression: $ => {
      const table = [
        ["+", 12],
        ["-", 12],
        ["*", 13],
        ["/", 13],
        ["%", 13],
        ["==", 9],
        ["!=", 9],
        ["<", 10],
        [">", 10],
        ["<=", 10],
        [">=", 10],
        ["&&", 5],
        ["||", 3],
        ["&", 8],
        ["|", 6],
        ["^", 7],
        ["<<", 11],
        [">>", 11],
        [">>>", 11],
        ["is", 9],
        ["!is", 9],
      ];
      return choice(
        ...table.map(([op, precedence]) =>
          prec.left(precedence, seq(
            field("left", $._expression),
            field("operator", op),
            field("right", $._expression),
          )),
        ),
      );
    },

    assignment_expression: $ => prec.right(1, seq(
      field("left", $._expression),
      field("operator", choice(
        "=", "+=", "-=", "*=", "/=", "%=",
        "&=", "|=", "^=", "<<=", ">>=", ">>>=",
      )),
      field("right", $._expression),
    )),

    // =========================================================================
    // INITIALIZER LIST & ARGUMENT LIST (stubs — Step 4 expands)
    // =========================================================================
    initializer_list: $ => seq(
      "{",
      commaSep($._expression),
      optional(","),
      "}",
    ),

    argument_list: $ => seq(
      "(",
      commaSep($._expression),
      ")",
    ),

    // =========================================================================
    // LITERALS
    // =========================================================================
    boolean_literal: _ => choice("true", "false"),

    null_literal: _ => "null",

    string_literal: _ => token(choice(
      seq("'", repeat(choice(/[^'\\]/, /\\./)), "'"),
      seq('"', repeat(choice(/[^"\\]/, /\\./)), '"'),
    )),

    number_literal: _ => {
      const hex = /0[xX][0-9a-fA-F]+/;
      const octal = /0[oO][0-7]+/;
      const binary = /0[bB][01]+/;
      const decimal_float = choice(
        /[0-9]+\.[0-9]*([eE][+-]?[0-9]+)?[fFdD]?/,
        /[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/,
        /[0-9]+[eE][+-]?[0-9]+[fFdD]?/,
        /[0-9]+[fFdD]/,
      );
      const decimal_int = /[0-9]+/;
      return token(choice(hex, octal, binary, decimal_float, decimal_int));
    },

    // =========================================================================
    // PRIMITIVES
    // =========================================================================
    primitive_type: _ => choice(
      "void", "int", "int8", "int16", "int32", "int64", "uint",
      "uint8", "uint16", "uint32", "uint64", "float", "double", "bool",
    ),

    comment: _ => token(choice(
      seq("//", /(\\+(.|\r?\n)|[^\\\n])*/),
      seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
    )),

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});
