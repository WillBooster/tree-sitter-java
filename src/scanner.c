#include "tree_sitter/parser.h"

#include "identifierRanges.h"

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

enum TokenType {
  LINE_COMMENT_BODY,
  LINE_COMMENT_END,
  BLOCK_COMMENT_BODY,
  BLOCK_COMMENT_END,
  JAVA_WHITESPACE,
  IDENTIFIER,
  FIRST_WORD,
};

typedef struct {
  const char *spelling;
  bool reserved;
} Word;

// grammar.js declares an external token for each word, in this order after IDENTIFIER, and fails unless this lists
// exactly the grammar's keywords, sorted by strcmp, and marks its reserved words.
static const Word WORDS[] = {
  {"_", true}, {"abstract", true}, {"assert", true}, {"boolean", true}, {"break", true}, {"byte", true},
  {"case", true}, {"catch", true}, {"char", true}, {"class", true}, {"const", true}, {"continue", true},
  {"default", true}, {"do", true}, {"double", true}, {"else", true}, {"enum", true}, {"exports", false},
  {"extends", true}, {"false", true}, {"final", true}, {"finally", true}, {"float", true}, {"for", true},
  {"goto", true}, {"if", true}, {"implements", true}, {"import", true}, {"instanceof", true}, {"int", true},
  {"interface", true}, {"long", true}, {"module", false}, {"native", true}, {"new", true}, {"non-sealed", false},
  {"null", true}, {"open", false}, {"opens", false}, {"package", true}, {"permits", false}, {"private", true},
  {"protected", true}, {"provides", false}, {"public", true}, {"record", false}, {"requires", false},
  {"return", true}, {"sealed", false}, {"short", true}, {"static", true}, {"strictfp", true}, {"super", true},
  {"switch", true}, {"synchronized", true}, {"this", true}, {"throw", true}, {"throws", true}, {"to", false},
  {"transient", true}, {"transitive", false}, {"true", true}, {"try", true}, {"uses", false}, {"void", true},
  {"volatile", true}, {"when", false}, {"while", true}, {"with", false}, {"yield", false},
};

#define WORD_COUNT (sizeof(WORDS) / sizeof(WORDS[0]))
#define LONGEST_WORD sizeof("synchronized")
#define RANGE_COUNT(ranges) (sizeof(ranges) / sizeof(ranges[0]))

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

// Combines an encoded surrogate pair into one code point; any other encoded surrogate yields -1, which no token accepts.
static bool next_code_point(TSLexer *lexer, Translation *state, int32_t *character) {
  if (!next_character(lexer, state, character)) return false;
  if (!state->encoded || *character < 0xd800 || *character > 0xdbff) return true;
  int32_t high = *character;
  *character = -1;
  if (lexer->lookahead != '\\') return true;
  int32_t low;
  if (!next_character(lexer, state, &low) || !state->encoded || low < 0xdc00 || low > 0xdfff) return true;
  *character = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
  return true;
}

static bool whitespace(int32_t character) {
  return character == ' ' || character == '\t' || character == '\f' || character == '\r' || character == '\n';
}

static bool identifier_start(int32_t character) {
  if (character < 0x80) {
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || character == '_' ||
           character == '$';
  }
  return set_contains(IDENTIFIER_START, RANGE_COUNT(IDENTIFIER_START), character);
}

// Like javac, a keyword comparison skips only the ignorable characters of the Basic Multilingual Plane.
static bool keyword_ignorable(int32_t character) {
  if (character < 0x80) return character <= 8 || (character >= 0x0e && character <= 0x1b) || character == 0x7f;
  return character <= 0xffff && set_contains(IDENTIFIER_IGNORABLE, RANGE_COUNT(IDENTIFIER_IGNORABLE), character);
}

static bool identifier_part(int32_t character) {
  if (character < 0) return false;
  if (character < 0x80) {
    return identifier_start(character) || (character >= '0' && character <= '9') || keyword_ignorable(character);
  }
  return set_contains(IDENTIFIER_PART, RANGE_COUNT(IDENTIFIER_PART), character);
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

typedef struct {
  char text[LONGEST_WORD];
  unsigned length;
  bool overflow;
} Spelling;

// Adds a character of an identifier to the spelling that a keyword comparison sees.
static void spell(Spelling *spelling, int32_t character) {
  if (spelling->length > 0 && keyword_ignorable(character)) return;
  if (character < 0x80 && spelling->length + 1 < LONGEST_WORD) {
    spelling->text[spelling->length++] = (char)character;
    spelling->text[spelling->length] = '\0';
  } else {
    spelling->overflow = true;
  }
}

// Reads the identifier characters after the first and ends the token after them. Returns the next character, which
// the lexer has consumed only when a Unicode escape spells it (-1 for a malformed escape).
static int32_t scan_identifier_characters(TSLexer *lexer, Translation *state, Spelling *spelling, bool *consumed) {
  for (;;) {
    int32_t character = lexer->lookahead;
    if (character == '\\') {
      lexer->mark_end(lexer);
      *consumed = true;
      if (!next_code_point(lexer, state, &character)) return -1;
      if (!identifier_part(character)) return character;
      spell(spelling, character);
    } else if (identifier_part(character) && !(character == 0 && lexer->eof(lexer))) {
      lexer->advance(lexer, false);
      spell(spelling, character);
    } else {
      lexer->mark_end(lexer);
      *consumed = false;
      return character;
    }
  }
}

static int find_word(const Spelling *spelling) {
  if (spelling->overflow) return -1;
  unsigned low = 0;
  unsigned high = WORD_COUNT;
  while (low < high) {
    unsigned middle = (low + high) / 2;
    int order = strcmp(WORDS[middle].spelling, spelling->text);
    if (order == 0) return (int)middle;
    if (order < 0) low = middle + 1;
    else high = middle;
  }
  return -1;
}

static bool any_word_valid(const bool *valid_symbols) {
  for (unsigned i = IDENTIFIER; i < FIRST_WORD + WORD_COUNT; i++) {
    if (valid_symbols[i]) return true;
  }
  return false;
}

// Reads `sealed` after the hyphen of `non-sealed`; ignorable characters may follow each letter.
static bool scan_sealed(TSLexer *lexer, Translation *state) {
  const char *const expected = "sealed";
  const char *next = expected;
  int32_t character;
  while (*next) {
    if (!next_code_point(lexer, state, &character)) return false;
    if (character == *next) {
      next++;
    } else if (next == expected || !keyword_ignorable(character)) {
      return false;
    }
  }
  for (;;) {
    lexer->mark_end(lexer);
    if (!next_code_point(lexer, state, &character) || !keyword_ignorable(character)) return true;
  }
}

// Reads identifiers and keywords, which Unicode escapes may spell and in which a keyword comparison skips ignorable
// characters, choosing between a keyword and an identifier as the generated lexer does for its word token.
static bool scan_word(TSLexer *lexer, Translation *state, const bool *valid_symbols, int32_t character) {
  Spelling spelling = {.length = 0};
  spell(&spelling, character);
  bool consumed;
  character = scan_identifier_characters(lexer, state, &spelling, &consumed);
  if (character == '-' && !spelling.overflow && strcmp(spelling.text, "non") == 0) {
    unsigned non_sealed = FIRST_WORD + find_word(&(Spelling){.text = "non-sealed"});
    if (valid_symbols[non_sealed]) {
      if (!consumed) lexer->advance(lexer, false);
      if (scan_sealed(lexer, state)) {
        lexer->result_symbol = non_sealed;
        return true;
      }
    }
  }
  int word = find_word(&spelling);
  bool keyword = word >= 0 && (valid_symbols[FIRST_WORD + word] || WORDS[word].reserved);
  lexer->result_symbol = keyword ? FIRST_WORD + word : IDENTIFIER;
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
  if (valid_symbols[LINE_COMMENT_END]) lexer->mark_end(lexer);
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
  if (!next_code_point(lexer, &state, &character)) return false;
  if (valid_symbols[JAVA_WHITESPACE] && (whitespace(character) || (character == 0x1a && lexer->eof(lexer)))) return scan_whitespace(lexer, &state);
  if (identifier_start(character)) return any_word_valid(valid_symbols) && scan_word(lexer, &state, valid_symbols, character);
  if (character != '/' || !next_character(lexer, &state, &character)) return false;
  bool line = character == '/' && valid_symbols[LINE_COMMENT_BODY];
  if (!line && !(character == '*' && valid_symbols[BLOCK_COMMENT_BODY])) return false;
  return scan_comment_body(lexer, &state, line);
}
