#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdlib.h>

enum TokenType {
    TEMPLATE_OPEN,   // '<' as template opener
    TEMPLATE_CLOSE,  // '>' as template closer (consumes exactly one '>')
};

typedef struct {
    uint32_t template_depth;
} Scanner;

static bool is_alpha(int32_t c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

static bool is_alnum(int32_t c) {
    return is_alpha(c) || (c >= '0' && c <= '9');
}

static void skip_ws(TSLexer *lexer) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        lexer->advance(lexer, true);
    }
}

// After consuming '<', scan forward (without consuming) to determine if this
// looks like a template argument list. We look for a balanced closing '>' where
// the content between is plausible as type arguments.
//
// Returns true if it looks like a template, false otherwise.
//
// This is a heuristic scan. We track '<'/'>' nesting depth and verify that
// the content consists of identifiers, primitive keywords, commas, colons,
// brackets, '@', 'const', '?', and nested templates — all things that appear
// in AngelScript type expressions. If we encounter something that can't appear
// in a type (like arithmetic operators, numbers, parentheses for calls, or
// semicolons), it's not a template.
static bool scan_template_content(TSLexer *lexer) {
    int depth = 1;
    // Limit lookahead to avoid pathological cases
    int limit = 256;

    while (depth > 0 && limit > 0 && lexer->lookahead != 0) {
        limit--;
        int32_t c = lexer->lookahead;

        if (c == '<') {
            depth++;
            lexer->advance(lexer, false);
            continue;
        }

        if (c == '>') {
            depth--;
            if (depth == 0) {
                // Found the matching '>' — this is a template
                return true;
            }
            lexer->advance(lexer, false);
            continue;
        }

        // Valid inside template type arguments
        if (is_alnum(c) || c == '_') {
            // Skip identifier/keyword
            while (is_alnum(lexer->lookahead)) {
                lexer->advance(lexer, false);
            }
            continue;
        }

        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            lexer->advance(lexer, false);
            continue;
        }

        // ',' separates template arguments: Dict<string, int>
        // ':' for scope resolution: NS::Type
        // '[' ']' for array types: int[]
        // '@' for handle types: Type@
        // '?' for auto type
        if (c == ',' || c == ':' || c == '[' || c == ']' || c == '@' || c == '?') {
            lexer->advance(lexer, false);
            continue;
        }

        // Anything else (digits, operators, parens, semicolons, etc.)
        // means this is NOT a template argument list
        return false;
    }

    return false;
}

void *tree_sitter_angelscript_external_scanner_create(void) {
    Scanner *scanner = calloc(1, sizeof(Scanner));
    return scanner;
}

void tree_sitter_angelscript_external_scanner_destroy(void *payload) {
    free(payload);
}

unsigned tree_sitter_angelscript_external_scanner_serialize(
    void *payload, char *buffer
) {
    Scanner *scanner = (Scanner *)payload;
    buffer[0] = (char)(scanner->template_depth & 0xFF);
    buffer[1] = (char)((scanner->template_depth >> 8) & 0xFF);
    return 2;
}

void tree_sitter_angelscript_external_scanner_deserialize(
    void *payload, const char *buffer, unsigned length
) {
    Scanner *scanner = (Scanner *)payload;
    if (length >= 2) {
        scanner->template_depth =
            (unsigned char)buffer[0] |
            ((unsigned char)buffer[1] << 8);
    } else {
        scanner->template_depth = 0;
    }
}

bool tree_sitter_angelscript_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols
) {
    Scanner *scanner = (Scanner *)payload;

    skip_ws(lexer);

    // Template open: '<' when parser expects it could be a template
    if (valid_symbols[TEMPLATE_OPEN] && lexer->lookahead == '<') {
        lexer->advance(lexer, false);

        // Reject '<<' and '<=' — these are shift/comparison operators
        if (lexer->lookahead == '<' || lexer->lookahead == '=') {
            return false;
        }

        // Mark end at '<' — further reads are lookahead only
        lexer->mark_end(lexer);

        // Scan forward to check if the content between < and > looks like
        // template type arguments. This is the key heuristic that prevents
        // `a < b` from being parsed as a template open.
        if (!scan_template_content(lexer)) {
            return false;
        }

        lexer->result_symbol = TEMPLATE_OPEN;
        scanner->template_depth++;
        return true;
    }

    // Template close: '>' when inside a template context
    if (valid_symbols[TEMPLATE_CLOSE] && lexer->lookahead == '>') {
        lexer->advance(lexer, false);

        // Reject '>=' — this is a comparison operator, not a template close
        if (lexer->lookahead == '=') {
            return false;
        }

        // Consume exactly ONE '>', even if next char is also '>'
        // This handles '>>' being split as two template closes
        lexer->result_symbol = TEMPLATE_CLOSE;
        if (scanner->template_depth > 0) {
            scanner->template_depth--;
        }
        return true;
    }

    return false;
}
