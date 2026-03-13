/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "angelscript",

  extras: $ => [
    /\s+/,
    $.comment,
  ],

  word: $ => $.identifier,

  rules: {
    script: $ => repeat(choice(
      $.variable_declaration,
      ";",
    )),

    variable_declaration: $ => seq(
      $.type,
      $.identifier,
      ";",
    ),

    type: $ => choice(
      $.primitive_type,
      $.identifier,
    ),

    primitive_type: _ => choice(
      "void",
      "int",
      "int8",
      "int16",
      "int32",
      "int64",
      "uint",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "float",
      "double",
      "bool",
    ),

    comment: _ => token(choice(
      seq("//", /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        "/*",
        /[^*]*\*+([^/*][^*]*\*+)*/,
        "/",
      ),
    )),

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});
