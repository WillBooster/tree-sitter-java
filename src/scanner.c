#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>

enum TokenType { LINE_COMMENT_BODY, LINE_COMMENT_END, BLOCK_COMMENT_BODY, BLOCK_COMMENT_END, JAVA_WHITESPACE };

typedef struct {
  bool odd_backslashes;
  bool encoded;
} Translation;

static int hex_value(int32_t character) {
  if (character >= '0' && character <= '9') return character - '0';
  if (character >= 'a' && character <= 'f') return character - 'a' + 10;
  if (character >= 'A' && character <= 'F') return character - 'A' + 10;
  return -1;
}

static bool next_character(TSLexer *lexer, Translation *state, int32_t *character) {
  if (lexer->eof(lexer)) return false;
  *character = lexer->lookahead;
  lexer->advance(lexer, false);
  bool eligible = state->encoded || !state->odd_backslashes;
  if (*character == '\\' && eligible && lexer->lookahead == 'u') {
    do {
      lexer->advance(lexer, false);
    } while (lexer->lookahead == 'u');
    *character = 0;
    for (unsigned i = 0; i < 4; i++) {
      int digit = hex_value(lexer->lookahead);
      if (digit < 0 || lexer->eof(lexer)) return false;
      *character = (*character << 4) | digit;
      lexer->advance(lexer, false);
    }
    state->encoded = true;
  } else {
    state->encoded = false;
  }
  state->odd_backslashes = *character == '\\' && !state->odd_backslashes;
  return true;
}

static bool whitespace(int32_t character) {
  return character == ' ' || character == '\t' || character == '\f' || character == '\r' || character == '\n';
}

static bool scan_whitespace(TSLexer *lexer, Translation *state) {
  int32_t character;
  do {
    lexer->mark_end(lexer);
  } while (next_character(lexer, state, &character) && whitespace(character));
  lexer->result_symbol = JAVA_WHITESPACE;
  return true;
}

static bool scan_comment_body(TSLexer *lexer, Translation *state, bool line) {
  int32_t character;
  int32_t previous = 0;
  lexer->result_symbol = line ? LINE_COMMENT_BODY : BLOCK_COMMENT_BODY;
  lexer->mark_end(lexer);
  while (next_character(lexer, state, &character)) {
    if (line && (character == '\r' || character == '\n')) return true;
    if (!line && previous == '*' && character == '/') return true;
    lexer->mark_end(lexer);
    previous = character;
  }
  return true;
}

void *tree_sitter_java_external_scanner_create(void) { return NULL; }
void tree_sitter_java_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_java_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_java_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static bool scan_comment_end(TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[LINE_COMMENT_END] && valid_symbols[BLOCK_COMMENT_END]) return false;
  lexer->result_symbol = valid_symbols[LINE_COMMENT_END] ? LINE_COMMENT_END : BLOCK_COMMENT_END;
  if (valid_symbols[LINE_COMMENT_END] && lexer->eof(lexer)) return true;
  Translation state = {false, false};
  int32_t character;
  if (!next_character(lexer, &state, &character)) return false;
  if (valid_symbols[LINE_COMMENT_END]) return character == '\r' || character == '\n';
  return character == '/';
}

bool tree_sitter_java_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (valid_symbols[LINE_COMMENT_END] || valid_symbols[BLOCK_COMMENT_END]) return scan_comment_end(lexer, valid_symbols);
  Translation state = {false, false};
  int32_t character;
  if (!next_character(lexer, &state, &character)) return false;
  if (valid_symbols[JAVA_WHITESPACE] && whitespace(character)) return scan_whitespace(lexer, &state);
  if (character != '/' || !next_character(lexer, &state, &character)) return false;
  bool line = character == '/' && valid_symbols[LINE_COMMENT_BODY];
  if (!line && !(character == '*' && valid_symbols[BLOCK_COMMENT_BODY])) return false;
  return scan_comment_body(lexer, &state, line);
}
