/**
 * @file Java grammar for tree-sitter
 * @author Ayman Nadeem <aymannadeem@github.com>
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const IDENTIFIER_RANGES = require('./src/identifierRanges.json');
const JAVA_IDENTIFIER_START = characterClass(IDENTIFIER_RANGES.start);
const JAVA_IDENTIFIER_PART = characterClass(IDENTIFIER_RANGES.part);

const DECIMAL_DIGITS = token(sep1(/[0-9]+/, /_+/));
const DIGITS = token(choice('0', seq(/[1-9]/, optional(seq(optional(/_+/), DECIMAL_DIGITS)))));
const HEX_DIGITS = token(sep1(/[A-Fa-f0-9]+/, /_+/));

const JAVA_QUOTE = choice('"', /\\u+0022/);
const JAVA_CR = choice('\r', /\\u+000[dD]/);
const JAVA_LF = choice('\n', /\\u+000[aA]/);
const JAVA_LINE_TERMINATOR = choice(seq(JAVA_CR, JAVA_LF), JAVA_CR, JAVA_LF);
const JAVA_ENCODED_BACKSLASH = /\\u+005[cC]/;
const JAVA_SIMPLE_ESCAPE = /[btnfrs"'\\]/;
const JAVA_OCTAL_DIGIT = choice(/[0-7]/, /\\u+003[0-7]/);
const JAVA_ESCAPE = choice(
  seq('\\', choice(
    JAVA_SIMPLE_ESCAPE,
    seq(/[0-3]/, optional(JAVA_OCTAL_DIGIT), optional(JAVA_OCTAL_DIGIT)),
    seq(/[4-7]/, optional(JAVA_OCTAL_DIGIT)),
  )),
  seq(JAVA_ENCODED_BACKSLASH, choice(
    /[btnfrs"']/,
    /\\u+00(22|27|5[cC]|62|66|6[eE]|72|73|74)/,
    seq(choice(/[0-3]/, /\\u+003[0-3]/), optional(JAVA_OCTAL_DIGIT), optional(JAVA_OCTAL_DIGIT)),
    seq(choice(/[4-7]/, /\\u+003[4-7]/), optional(JAVA_OCTAL_DIGIT)),
  )),
);

const PREC = {
  LAMBDA: -1,
  // https://introcs.cs.princeton.edu/java/11precedence/
  ASSIGN: 1,
  DECL: 2,
  ELEMENT_VAL: 2,
  TERNARY: 3,
  OR: 4,
  AND: 5,
  BIT_OR: 6,
  BIT_XOR: 7,
  BIT_AND: 8,
  EQUALITY: 9,
  GENERIC: 10,
  REL: 10,
  SHIFT: 11,
  ADD: 12,
  MULT: 13,
  CAST: 14,
  OBJ_INST: 14,
  UNARY: 15,
  ARRAY: 16,
  OBJ_ACCESS: 16,
  PARENS: 16,
  CLASS_LITERAL: 17,
};

const JAVA_KEYWORD_IGNORABLE = new RegExp(characterClass(IDENTIFIER_RANGES.ignorable.filter(([, end]) => end <= 0xffff)), 'u');
const JAVA_KEYWORD_IGNORABLES = `(?:${JAVA_KEYWORD_IGNORABLE.source}|${encodedCharacters(JAVA_KEYWORD_IGNORABLE, true)})*`;

module.exports = unicodeGrammar(grammar({
  name: 'java',

  extras: $ => [
    $.line_comment,
    $.block_comment,
    $._java_whitespace,
  ],

  externals: $ => [$._line_comment_body, $._line_comment_end, $._block_comment_body, $._block_comment_end, $._java_whitespace],

  supertypes: $ => [
    $.expression,
    $.declaration,
    $.statement,
    $.primary_expression,
    $._literal,
    $._type,
    $._unannotated_type,
    $.module_directive,
  ],

  inline: $ => [
    $._name,
    $._simple_type,
    $._class_body_declaration,
    $._variable_initializer,
  ],

  conflicts: $ => [
    [$.modifiers],
    [$._literal, $.switch_label],
    [$.dimensions],
    [$.array_type, $._unannotated_type],
    [$.array_type, $.primary_expression],
    [$.modifiers, $.annotated_type],
    [$.instanceof_expression, $.annotated_type],
    [$.modifiers, $.annotated_type, $.module_declaration, $.package_declaration],
    [$._unannotated_type, $.primary_expression, $.inferred_parameters],
    [$._unannotated_type, $.primary_expression],
    [$._unannotated_type, $.scoped_type_identifier],
    [$._unannotated_type, $.generic_type],
    [$.generic_type, $.primary_expression],
    [$.expression, $.statement],
    [$.inferred_parameters, $.primary_expression],
    [$.argument_list, $.record_pattern_body],
    [$.yield_statement, $._reserved_identifier],
    [$.scoped_identifier, $.scoped_type_identifier],
    [$.primary_expression, $.method_reference, $.scoped_identifier],
    [$.primary_expression, $.method_reference, $.scoped_identifier, $._unannotated_type, $.scoped_type_identifier],
  ],

  reserved: {
    global: $ => [
      'abstract',
      'assert',
      'boolean',
      'break',
      'byte',
      'case',
      'catch',
      'char',
      'class',
      $._const,
      'continue',
      'default',
      'do',
      'double',
      'else',
      'enum',
      'extends',
      'final',
      'finally',
      'float',
      'for',
      $._goto,
      'if',
      'implements',
      'import',
      'instanceof',
      'int',
      'interface',
      'long',
      'native',
      'new',
      'package',
      'private',
      'protected',
      'public',
      'return',
      'short',
      'static',
      'strictfp',
      $.super,
      'switch',
      'synchronized',
      $.this,
      'throw',
      'throws',
      'transient',
      'try',
      'void',
      'volatile',
      'while',
      $.underscore_pattern,
      $.true,
      $.false,
      $.null_literal,
    ],
  },

  word: $ => $.identifier,

  rules: {
    program: $ => repeat($._toplevel_statement),

    _toplevel_statement: $ => choice(
      $.statement,
      $.method_declaration,
    ),

    _literal: $ => choice(
      $.decimal_integer_literal,
      $.hex_integer_literal,
      $.octal_integer_literal,
      $.binary_integer_literal,
      $.decimal_floating_point_literal,
      $.hex_floating_point_literal,
      $.true,
      $.false,
      $.character_literal,
      $.string_literal,
      $.null_literal,
    ),

    decimal_integer_literal: _ => token(seq(
      DIGITS,
      optional(choice('l', 'L')),
    )),

    hex_integer_literal: _ => token(seq(
      choice('0x', '0X'),
      HEX_DIGITS,
      optional(choice('l', 'L')),
    )),

    octal_integer_literal: _ => token(seq(
      '0',
      optional(/_+/),
      sep1(/[0-7]+/, /_+/),
      optional(choice('l', 'L')),
    )),

    binary_integer_literal: _ => token(seq(
      choice('0b', '0B'),
      sep1(/[01]+/, /_+/),
      optional(choice('l', 'L')),
    )),

    decimal_floating_point_literal: _ => token(choice(
      seq(DECIMAL_DIGITS, '.', optional(DECIMAL_DIGITS), optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), optional(/[fFdD]/)),
      seq('.', DECIMAL_DIGITS, optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), optional(/[fFdD]/)),
      seq(DECIMAL_DIGITS, /[eE]/, optional(choice('-', '+')), DECIMAL_DIGITS, optional(/[fFdD]/)),
      seq(DECIMAL_DIGITS, optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), (/[fFdD]/)),
    )),

    hex_floating_point_literal: $ => choice(
      token(seq(
        choice('0x', '0X'),
        HEX_DIGITS,
        /[pP]/,
        optional(choice('-', '+')),
        DECIMAL_DIGITS,
        optional(/[fFdD]/),
      )),
      seq($._hex_floating_significand, $._hex_floating_exponent),
    ),

    _hex_floating_significand: _ => token(seq(
      choice('0x', '0X'),
      choice(
        seq(HEX_DIGITS, '.', optional(HEX_DIGITS)),
        seq('.', HEX_DIGITS),
      ),
    )),

    _hex_floating_exponent: _ => token.immediate(seq(
      /[pP]/,
      optional(choice('-', '+')),
      DECIMAL_DIGITS,
      optional(/[fFdD]/),
    )),

    true: _ => 'true',

    false: _ => 'false',

    character_literal: _ => {
      const quote = choice('\'', /\\u+0027/);
      const encodedBackslash = /\\u+005[cC]/;
      const unicodeCharacter = /\\u+([1-9a-fA-F][0-9a-fA-F]{3}|0[1-9a-fA-F][0-9a-fA-F]{2}|00[1346-9a-fA-F][0-9a-fA-F]|000[0-9bcefBCEF]|002[0-68-9a-fA-F]|005[0-9abd-fABD-F])/;
      const plainCharacter = /[^\r\n'\\\u{10000}-\u{10FFFF}]/u;
      const simpleEscape = /[btnfrs"'\\]/;
      const octalDigit = choice(/[0-7]/, /\\u+003[0-7]/);
      return token(seq(quote, choice(
        plainCharacter,
        unicodeCharacter,
        seq('\\', choice(
          simpleEscape,
          seq(/[0-3]/, optional(octalDigit), optional(octalDigit)),
          seq(/[4-7]/, optional(octalDigit)),
        )),
        seq(encodedBackslash, choice(
          simpleEscape,
          /\\u+00(22|27|5[cC]|62|66|6[eE]|72|73|74)/,
          seq(choice(/[0-3]/, /\\u+003[0-3]/), optional(octalDigit), optional(octalDigit)),
          seq(choice(/[4-7]/, /\\u+003[4-7]/), optional(octalDigit)),
        )),
      ), quote));
    },

    string_literal: $ => choice($._string_literal, $._multiline_string_literal),
    _string_literal: $ => seq(
      alias(token(prec(2, JAVA_QUOTE)), '"'),
      javaStringContent($, false),
      alias(token.immediate(prec(2, JAVA_QUOTE)), '"'),
    ),
    _multiline_string_literal: $ => seq(
      alias($._text_block_open, '"""'),
      javaStringContent($, true),
      alias($._text_block_close, '"""'),
    ),
    _text_block_open: _ => token(prec(3, seq(
      JAVA_QUOTE, JAVA_QUOTE, JAVA_QUOTE,
      repeat(choice(/[ \t\f]/, /\\u+00(20|09|0[cC])/)),
      JAVA_LINE_TERMINATOR,
    ))),
    _text_block_close: _ => token.immediate(prec(3, seq(JAVA_QUOTE, JAVA_QUOTE, JAVA_QUOTE))),
    string_fragment: _ => token.immediate(prec(1, /[^"\\\r\n]+/)),
    _non_u_string_fragment: _ => token.immediate(prec(1, /[^u"\\\r\n][^"\\\r\n]*/)),
    _non_u_multiline_string_fragment: _ => token.immediate(prec(1, choice(
      /[^u"\\][^"\\]*/,
      seq(JAVA_QUOTE, /[^"\\]*/),
      seq(JAVA_QUOTE, JAVA_QUOTE, /[^"\\]*/),
    ))),
    _encoded_backslash_escape: _ => token.immediate(seq(JAVA_ENCODED_BACKSLASH, '\\')),
    _multiline_string_fragment: _ => token.immediate(prec(1, choice(
      /[^"\\]+/,
      seq(JAVA_QUOTE, /[^"\\]*/),
      seq(JAVA_QUOTE, JAVA_QUOTE, /[^"\\]*/),
    ))),

    string_interpolation: $ => seq(
      alias(token.immediate(choice('\\{', seq(JAVA_ENCODED_BACKSLASH, choice('{', /\\u+007[bB]/)))), '\\{'),
      $.expression,
      alias(token(choice('}', /\\u+007[dD]/)), '}'),
    ),

    escape_sequence: _ => javaStringEscape(false),
    _text_block_escape_sequence: _ => javaStringEscape(true),

    null_literal: _ => 'null',

    expression: $ => choice(
      $.assignment_expression,
      $.binary_expression,
      $.instanceof_expression,
      $.lambda_expression,
      $.ternary_expression,
      $.update_expression,
      $.primary_expression,
      $.unary_expression,
      $.cast_expression,
      $.switch_expression,
    ),

    cast_expression: $ => prec.right(PREC.CAST, choice(
      seq(
        '(',
        field('type', $._type),
        ')',
        field('value', $.expression),
      ),
      seq(
        '(',
        sep1(field('type', $._type), '&'),
        ')',
        field('value', choice(
          $.primary_expression,
          alias($._postfix_update_expression, $.update_expression),
          alias($._unary_complement_expression, $.unary_expression),
          $.cast_expression,
          $.switch_expression,
          $.lambda_expression,
        )),
      ),
    )),

    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', choice(
        $.identifier,
        $._reserved_identifier,
        $.field_access,
        $.array_access,
        $.parenthesized_expression,
      )),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>=')),
      field('right', $.expression),
    )),

    binary_expression: $ => choice(
      ...[
        ['>', PREC.REL],
        ['<', PREC.REL],
        ['>=', PREC.REL],
        ['<=', PREC.REL],
        ['==', PREC.EQUALITY],
        ['!=', PREC.EQUALITY],
        ['&&', PREC.AND],
        ['||', PREC.OR],
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULT],
        ['/', PREC.MULT],
        ['&', PREC.BIT_AND],
        ['|', PREC.BIT_OR],
        ['^', PREC.BIT_XOR],
        ['%', PREC.MULT],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['>>>', PREC.SHIFT],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        )),
      )),

    instanceof_expression: $ => prec(PREC.REL, seq(
      field('left', $.expression),
      'instanceof',
      choice(
        seq(
          repeat(choice($._annotation, 'final')),
          field('right', $._unannotated_type),
          field('name', choice($.identifier, $._reserved_identifier, alias('when', $.identifier), $.underscore_pattern)),
        ),
        field('right', $._type),
        field('pattern', $.record_pattern),
      ),
    )),

    lambda_expression: $ => prec(PREC.LAMBDA, seq(
      field('parameters', choice(
        $.identifier, alias($._lambda_parameters, $.formal_parameters), $.inferred_parameters, $._reserved_identifier, $.underscore_pattern,
      )),
      '->',
      field('body', choice($.expression, $.block)),
    )),

    _lambda_parameters: $ => seq(
      '(',
      commaSep(choice($.formal_parameter, $.spread_parameter)),
      ')',
    ),

    inferred_parameters: $ => seq(
      '(',
      commaSep1(choice($.identifier, $._reserved_identifier, $.underscore_pattern)),
      ')',
    ),

    ternary_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $.expression),
      '?',
      field('consequence', $.expression),
      ':',
      field('alternative', $.expression),
    )),

    unary_expression: $ => choice(
      $._unary_complement_expression,
      prec.left(PREC.UNARY, seq(
        field('operator', choice('+', '-')),
        field('operand', $.expression),
      )),
    ),

    _unary_complement_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('~', '!')),
      field('operand', $.expression),
    )),

    update_expression: $ => choice(
      $._postfix_update_expression,
      prec.right(PREC.UNARY, choice(
        seq('++', $.primary_expression),
        seq('--', $.primary_expression),
      )),
    ),

    _postfix_update_expression: $ => prec.right(PREC.UNARY, choice(
      seq($.primary_expression, '++'),
      seq($.primary_expression, '--'),
    )),

    primary_expression: $ => choice(
      $._literal,
      $.class_literal,
      $.this,
      $.identifier,
      $._reserved_identifier,
      $.parenthesized_expression,
      $.object_creation_expression,
      $.field_access,
      $.array_access,
      $.method_invocation,
      $.method_reference,
      $.array_creation_expression,
      $.template_expression,
    ),

    array_creation_expression: $ => prec.right(seq(
      'new',
      repeat($._annotation),
      field('type', $._simple_type),
      choice(
        seq(
          field('dimensions', repeat1($.dimensions_expr)),
          field('dimensions', optional($.dimensions)),
        ),
        seq(
          field('dimensions', $.dimensions),
          field('value', $.array_initializer),
        ),
      ),
    )),

    dimensions_expr: $ => seq(repeat($._annotation), '[', $.expression, ']'),

    parenthesized_expression: $ => seq('(', $.expression, ')'),

    class_literal: $ => prec.dynamic(PREC.CLASS_LITERAL, seq($._unannotated_type, '.', 'class')),

    object_creation_expression: $ => choice(
      $._unqualified_object_creation_expression,
      seq($.primary_expression, '.', $._unqualified_object_creation_expression),
    ),

    _unqualified_object_creation_expression: $ => prec.right(seq(
      'new',
      choice(
        seq(
          repeat($._annotation),
          field('type_arguments', $.type_arguments),
          repeat($._annotation),
        ),
        repeat($._annotation),
      ),
      field('type', $._simple_type),
      field('arguments', $.argument_list),
      optional($.class_body),
    )),

    field_access: $ => seq(
      field('object', choice($.primary_expression, $.super)),
      optional(seq(
        '.',
        $.super,
      )),
      '.',
      field('field', choice($.identifier, $._reserved_identifier, $.this)),
    ),

    template_expression: $ => seq(
      field('template_processor', $.primary_expression),
      '.',
      field('template_argument', $.string_literal),
    ),

    array_access: $ => seq(
      field('array', $.primary_expression),
      '[',
      field('index', $.expression),
      ']',
    ),

    method_invocation: $ => seq(
      choice(
        field('name', choice($.identifier, $._reserved_identifier)),
        seq(
          field('object', choice($.primary_expression, $.super)),
          '.',
          optional(seq(
            $.super,
            '.',
          )),
          field('type_arguments', optional($.type_arguments)),
          field('name', choice($.identifier, $._reserved_identifier)),
        ),
      ),
      field('arguments', $.argument_list),
    ),

    argument_list: $ => seq('(', commaSep($.expression), ')'),

    method_reference: $ => choice(
      seq(
        choice($._type, $.primary_expression, $.super),
        '::',
        optional($.type_arguments),
        choice('new', $.identifier),
      ),
      seq(
        $._name, '.', $.super,
        '::',
        optional($.type_arguments),
        $.identifier,
      ),
    ),

    type_arguments: $ => seq(
      '<',
      commaSep(choice($._type, $.wildcard)),
      '>',
    ),

    wildcard: $ => seq(
      repeat($._annotation),
      '?',
      optional($._wildcard_bounds),
    ),

    _wildcard_bounds: $ => choice(
      seq('extends', $._type),
      seq($.super, $._type),
    ),

    dimensions: $ => repeat1(
      seq(repeat($._annotation), '[', ']'),
    ),

    switch_expression: $ => seq(
      'switch',
      field('condition', $.parenthesized_expression),
      field('body', $.switch_block),
    ),

    switch_block: $ => seq(
      '{',
      choice(
        repeat($.switch_block_statement_group),
        repeat($.switch_rule),
      ),
      '}',
    ),

    switch_block_statement_group: $ => prec.left(seq(
      repeat1(seq($.switch_label, ':')),
      repeat($.statement),
    )),

    switch_rule: $ => seq(
      $.switch_label,
      '->',
      choice($.expression_statement, $.throw_statement, $.block),
    ),

    switch_label: $ => choice(
      prec.dynamic(1, seq('case', $.null_literal, ',', 'default')),
      seq('case',
        choice(
          commaSep1($.pattern),
          commaSep1($.expression),
        ),
        optional($.guard),
      ),
      'default',
    ),

    pattern: $ => choice(
      $.type_pattern,
      $.record_pattern,
    ),
    type_pattern: $ => seq(repeat(choice($._annotation, 'final')), $._unannotated_type, choice($.identifier, $._reserved_identifier, alias('when', $.identifier), $.underscore_pattern)),
    record_pattern: $ => seq(choice($.identifier, $._reserved_identifier, $.generic_type, $.scoped_type_identifier), $.record_pattern_body),
    record_pattern_body: $ => seq('(', commaSep(choice($.record_pattern_component, $.record_pattern)), ')'),
    record_pattern_component: $ => choice(
      $.underscore_pattern,
      seq(
        repeat(choice($._annotation, 'final')),
        $._unannotated_type,
        choice($.identifier, $._reserved_identifier, alias('when', $.identifier), $.underscore_pattern),
      ),
    ),

    underscore_pattern: _ => '_',

    guard: $ => seq('when', $.expression),

    statement: $ => choice(
      $.declaration,
      $.expression_statement,
      $.labeled_statement,
      $.if_statement,
      $.while_statement,
      $.for_statement,
      $.enhanced_for_statement,
      $.block,
      ';',
      $.assert_statement,
      $.do_statement,
      $.break_statement,
      $.continue_statement,
      $.return_statement,
      $.yield_statement,
      $.switch_expression,
      $.synchronized_statement,
      $.local_variable_declaration,
      $.throw_statement,
      $.try_statement,
      $.try_with_resources_statement,
    ),

    block: $ => seq(
      '{', repeat($.statement), '}',
    ),

    expression_statement: $ => seq(
      $.expression,
      ';',
    ),

    labeled_statement: $ => seq(
      choice($.identifier, $._reserved_identifier), ':', $.statement,
    ),

    assert_statement: $ => choice(
      seq('assert', $.expression, ';'),
      seq('assert', $.expression, ':', $.expression, ';'),
    ),

    do_statement: $ => seq(
      'do',
      field('body', $.statement),
      'while',
      field('condition', $.parenthesized_expression),
      ';',
    ),

    break_statement: $ => seq('break', optional($.identifier), ';'),

    continue_statement: $ => seq('continue', optional($.identifier), ';'),

    return_statement: $ => seq(
      'return',
      optional($.expression),
      ';',
    ),

    yield_statement: $ => seq(
      'yield',
      $.expression,
      ';',
    ),

    synchronized_statement: $ => seq(
      'synchronized',
      $.parenthesized_expression,
      field('body', $.block),
    ),

    throw_statement: $ => seq('throw', $.expression, ';'),

    try_statement: $ => seq(
      'try',
      field('body', $.block),
      choice(
        repeat1($.catch_clause),
        seq(repeat($.catch_clause), $.finally_clause),
      ),
    ),

    catch_clause: $ => seq(
      'catch',
      '(',
      $.catch_formal_parameter,
      ')',
      field('body', $.block),
    ),

    catch_formal_parameter: $ => seq(
      optional($.modifiers),
      $.catch_type,
      $._variable_declarator_id,
    ),

    catch_type: $ => seq(
      $._unannotated_type,
      repeat(seq('|', $._type)),
    ),

    finally_clause: $ => seq('finally', $.block),

    try_with_resources_statement: $ => seq(
      'try',
      field('resources', $.resource_specification),
      field('body', $.block),
      repeat($.catch_clause),
      optional($.finally_clause),
    ),

    resource_specification: $ => seq(
      '(', sep1($.resource, ';'), optional(';'), ')',
    ),

    resource: $ => choice(
      seq(
        optional($.modifiers),
        field('type', $._unannotated_type),
        $._variable_declarator_id,
        '=',
        field('value', $.expression),
      ),
      $.identifier,
      $.field_access,
    ),

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $.statement),
      optional(seq('else', field('alternative', $.statement))),
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $.statement),
    ),

    for_statement: $ => seq(
      'for', '(',
      choice(
        field('init', $.local_variable_declaration),
        seq(
          commaSep(field('init', $.expression)),
          ';',
        ),
      ),
      field('condition', optional($.expression)), ';',
      commaSep(field('update', $.expression)), ')',
      field('body', $.statement),
    ),

    enhanced_for_statement: $ => seq(
      'for',
      '(',
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_id,
      ':',
      field('value', $.expression),
      ')',
      field('body', $.statement),
    ),

    _annotation: $ => choice(
      $.marker_annotation,
      $.annotation,
    ),

    marker_annotation: $ => seq(
      '@',
      field('name', $._name),
    ),

    annotation: $ => seq(
      '@',
      field('name', $._name),
      field('arguments', $.annotation_argument_list),
    ),

    annotation_argument_list: $ => seq(
      '(',
      choice(
        $._element_value,
        commaSep($.element_value_pair),
      ),
      ')',
    ),

    element_value_pair: $ => seq(
      field('key', choice($.identifier, $._reserved_identifier)),
      '=',
      field('value', $._element_value),
    ),

    _element_value: $ => prec(PREC.ELEMENT_VAL, choice(
      $.expression,
      $.element_value_array_initializer,
      $._annotation,
    )),

    element_value_array_initializer: $ => seq(
      '{',
      commaSep($._element_value),
      optional(','),
      '}',
    ),

    declaration: $ => prec(PREC.DECL, choice(
      $.module_declaration,
      $.package_declaration,
      $.import_declaration,
      $.class_declaration,
      $.record_declaration,
      $.interface_declaration,
      $.annotation_type_declaration,
      $.enum_declaration,
    )),

    module_declaration: $ => seq(
      repeat($._annotation),
      optional('open'),
      'module',
      field('name', $._name),
      field('body', $.module_body),
    ),

    module_body: $ => seq(
      '{',
      repeat($.module_directive),
      '}',
    ),

    module_directive: $ => choice(
      $.requires_module_directive,
      $.exports_module_directive,
      $.opens_module_directive,
      $.uses_module_directive,
      $.provides_module_directive,
    ),

    requires_module_directive: $ => seq(
      'requires',
      repeat(field('modifiers', $.requires_modifier)),
      field('module', $._name),
      ';',
    ),

    requires_modifier: _ => choice(
      'transitive',
      'static',
    ),

    exports_module_directive: $ => seq(
      'exports',
      field('package', $._name),
      optional(seq(
        'to',
        field('modules', $._name),
        repeat(seq(',', field('modules', $._name))),
      )),
      ';',
    ),

    opens_module_directive: $ => seq(
      'opens',
      field('package', $._name),
      optional(seq(
        'to',
        field('modules', $._name),
        repeat(seq(',', field('modules', $._name))),
      )),
      ';',
    ),

    uses_module_directive: $ => seq(
      'uses',
      field('type', $._name),
      ';',
    ),

    provides_module_directive: $ => seq(
      'provides',
      field('provided', $._name),
      'with',
      field('provider', $._name),
      repeat(seq(',', field('provider', $._name))),
      ';',
    ),

    package_declaration: $ => seq(
      repeat($._annotation),
      'package',
      $._name,
      ';',
    ),

    import_declaration: $ => seq(
      'import',
      choice(
        seq('module', $._name),
        seq(optional('static'), $._name, optional(seq('.', $.asterisk))),
      ),
      ';',
    ),

    asterisk: _ => '*',

    enum_declaration: $ => seq(
      optional($.modifiers),
      'enum',
      field('name', $.identifier),
      field('interfaces', optional($.super_interfaces)),
      field('body', $.enum_body),
    ),

    enum_body: $ => seq(
      '{',
      commaSep($.enum_constant),
      optional(','),
      optional($.enum_body_declarations),
      '}',
    ),

    enum_body_declarations: $ => seq(
      ';',
      repeat($._class_body_declaration),
    ),

    enum_constant: $ => (seq(
      optional($.modifiers),
      field('name', $.identifier),
      field('arguments', optional($.argument_list)),
      field('body', optional($.class_body)),
    )),

    class_declaration: $ => seq(
      optional($.modifiers),
      'class',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional(field('superclass', $.superclass)),
      optional(field('interfaces', $.super_interfaces)),
      optional(field('permits', $.permits)),
      field('body', $.class_body),
    ),

    modifiers: $ => repeat1(choice(
      $._annotation,
      $.visibility,
      $.modifier,
    )),

    visibility: _ => choice('public', 'protected', 'private'),

    modifier: _ => choice(
      'abstract',
      'static',
      'final',
      'strictfp',
      'default',
      'synchronized',
      'native',
      'transient',
      'volatile',
      'sealed',
      'non-sealed',
    ),

    type_parameters: $ => seq(
      '<', commaSep1($.type_parameter), '>',
    ),

    type_parameter: $ => seq(
      repeat($._annotation),
      alias($.identifier, $.type_identifier),
      optional($.type_bound),
    ),

    type_bound: $ => seq('extends', $._type, repeat(seq('&', $._type))),

    superclass: $ => seq(
      'extends',
      $._type,
    ),

    super_interfaces: $ => seq(
      'implements',
      $.type_list,
    ),

    type_list: $ => seq(
      $._type,
      repeat(seq(',', $._type)),
    ),

    permits: $ => seq(
      'permits',
      $.type_list,
    ),

    class_body: $ => seq(
      '{',
      repeat($._class_body_declaration),
      '}',
    ),

    _class_body_declaration: $ => choice(
      $.field_declaration,
      $.record_declaration,
      $.method_declaration,
      $.compact_constructor_declaration,
      $.class_declaration,
      $.interface_declaration,
      $.annotation_type_declaration,
      $.enum_declaration,
      $.block,
      $.static_initializer,
      $.constructor_declaration,
      ';',
    ),

    static_initializer: $ => seq(
      'static',
      $.block,
    ),

    constructor_declaration: $ => seq(
      optional($.modifiers),
      $._constructor_declarator,
      optional($.throws),
      field('body', $.constructor_body),
    ),

    _constructor_declarator: $ => seq(
      field('type_parameters', optional($.type_parameters)),
      field('name', $.identifier),
      field('parameters', $.formal_parameters),
    ),

    constructor_body: $ => seq(
      '{',
      repeat($.statement),
      optional(seq($.explicit_constructor_invocation, repeat($.statement))),
      '}',
    ),

    explicit_constructor_invocation: $ => seq(
      choice(
        seq(
          field('type_arguments', optional($.type_arguments)),
          field('constructor', choice($.this, $.super)),
        ),
        seq(
          field('object', choice($.primary_expression)),
          '.',
          field('type_arguments', optional($.type_arguments)),
          field('constructor', $.super),
        ),
      ),
      field('arguments', $.argument_list),
      ';',
    ),

    _name: $ => choice(
      $.identifier,
      $._reserved_identifier,
      $.scoped_identifier,
    ),

    scoped_identifier: $ => seq(
      field('scope', $._name),
      '.',
      field('name', $.identifier),
    ),

    field_declaration: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_list,
      ';',
    ),

    record_declaration: $ => seq(
      optional($.modifiers),
      'record',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.record_header),
      optional(field('interfaces', $.super_interfaces)),
      field('body', $.class_body),
    ),

    record_header: $ => seq('(', commaSep($.record_component), ')'),

    record_component: $ => seq(
      repeat($._annotation),
      field('type', $._unannotated_type),
      optional(seq(repeat($._annotation), '...')),
      field('name', choice($.identifier, $._reserved_identifier)),
      field('dimensions', optional(alias($._annotated_dimensions, $.dimensions))),
    ),

    annotation_type_declaration: $ => seq(
      optional($.modifiers),
      '@',
      'interface',
      field('name', $.identifier),
      field('body', $.annotation_type_body),
    ),

    annotation_type_body: $ => seq(
      '{',
      repeat(choice(
        $.annotation_type_element_declaration,
        $.constant_declaration,
        $.class_declaration,
        $.record_declaration,
        $.interface_declaration,
        $.enum_declaration,
        $.annotation_type_declaration,
        ';',
      )),
      '}',
    ),

    annotation_type_element_declaration: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      field('name', choice($.identifier, $._reserved_identifier)),
      '(', ')',
      field('dimensions', optional($.dimensions)),
      optional($._default_value),
      ';',
    ),

    _default_value: $ => seq(
      'default',
      field('value', $._element_value),
    ),

    interface_declaration: $ => seq(
      optional($.modifiers),
      'interface',
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameters)),
      optional($.extends_interfaces),
      optional(field('permits', $.permits)),
      field('body', $.interface_body),
    ),

    extends_interfaces: $ => seq(
      'extends',
      $.type_list,
    ),

    interface_body: $ => seq(
      '{',
      repeat(choice(
        $.constant_declaration,
        $.enum_declaration,
        $.method_declaration,
        $.class_declaration,
        $.interface_declaration,
        $.record_declaration,
        $.annotation_type_declaration,
        ';',
      )),
      '}',
    ),

    constant_declaration: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_list,
      ';',
    ),

    _variable_declarator_list: $ => commaSep1(
      field('declarator', $.variable_declarator),
    ),

    variable_declarator: $ => seq(
      $._variable_declarator_id,
      optional(seq('=', field('value', $._variable_initializer))),
    ),

    _variable_declarator_id: $ => seq(
      field('name', choice($.identifier, $._reserved_identifier, $.underscore_pattern)),
      field('dimensions', optional($.dimensions)),
    ),

    _variable_initializer: $ => choice(
      $.expression,
      $.array_initializer,
    ),

    array_initializer: $ => seq(
      '{',
      commaSep($._variable_initializer),
      optional(','),
      '}',
    ),

    _type: $ => choice(
      $._unannotated_type,
      $.annotated_type,
    ),

    _unannotated_type: $ => choice(
      $._simple_type,
      $.array_type,
    ),

    _simple_type: $ => choice(
      $.void_type,
      $.integral_type,
      $.floating_point_type,
      $.boolean_type,
      alias($.identifier, $.type_identifier),
      $.scoped_type_identifier,
      $.generic_type,
    ),

    annotated_type: $ => seq(
      repeat1($._annotation),
      $._unannotated_type,
    ),

    scoped_type_identifier: $ => seq(
      choice(
        alias($.identifier, $.type_identifier),
        $.scoped_type_identifier,
        $.generic_type,
      ),
      '.',
      repeat($._annotation),
      alias($.identifier, $.type_identifier),
    ),

    generic_type: $ => prec.dynamic(PREC.GENERIC, seq(
      choice(
        alias($.identifier, $.type_identifier),
        $.scoped_type_identifier,
      ),
      $.type_arguments,
    )),

    array_type: $ => seq(
      field('element', $._simple_type),
      field('dimensions', $.dimensions),
    ),

    integral_type: _ => choice(
      'byte',
      'short',
      'int',
      'long',
      'char',
    ),

    floating_point_type: _ => choice(
      'float',
      'double',
    ),

    boolean_type: _ => 'boolean',

    void_type: _ => 'void',

    _method_header: $ => seq(
      optional(seq(
        field('type_parameters', $.type_parameters),
        repeat($._annotation),
      )),
      field('type', $._unannotated_type),
      $._method_declarator,
      optional($.throws),
    ),

    _method_declarator: $ => seq(
      field('name', choice($.identifier, $._reserved_identifier)),
      field('parameters', $.formal_parameters),
      field('dimensions', optional($.dimensions)),
    ),

    formal_parameters: $ => seq(
      '(',
      choice(
        $.receiver_parameter,
        seq(
          optional(seq($.receiver_parameter, ',')),
          commaSep(choice($.formal_parameter, $.spread_parameter)),
        ),
      ),
      ')',
    ),

    formal_parameter: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_id,
    ),

    receiver_parameter: $ => prec.dynamic(1, seq(
      repeat($._annotation),
      $._unannotated_type,
      repeat(seq($.identifier, '.')),
      $.this,
    )),

    spread_parameter: $ => seq(
      field('modifiers', optional($.modifiers)),
      field('type', $._unannotated_type),
      field('annotations', repeat($._annotation)),
      '...',
      field('name', choice($.identifier, $._reserved_identifier, $.underscore_pattern)),
      field('dimensions', optional(alias($._annotated_dimensions, $.dimensions))),
    ),

    _annotated_dimensions: $ => seq(
      repeat1($._annotation), '[', ']',
      repeat(seq(repeat($._annotation), '[', ']')),
    ),

    throws: $ => seq(
      'throws', commaSep1($._type),
    ),

    local_variable_declaration: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_list,
      ';',
    ),

    method_declaration: $ => seq(
      optional($.modifiers),
      $._method_header,
      choice(field('body', $.block), ';'),
    ),

    compact_constructor_declaration: $ => seq(
      optional($.modifiers),
      field('name', $.identifier),
      field('body', $.block),
    ),

    _reserved_identifier: $ => choice(
      prec(-3, alias(
        choice(
          'open',
          'module',
          'record',
          'with',
          'sealed',
        ),
        $.identifier,
      )),
      alias('yield', $.identifier),
    ),

    _const: _ => 'const',
    _goto: _ => 'goto',

    this: _ => 'this',

    super: _ => 'super',

    identifier: _ => new RegExp(`${JAVA_IDENTIFIER_START}${JAVA_IDENTIFIER_PART}*`, 'u'),
    line_comment: $ => seq($._line_comment_body, $._line_comment_end),
    block_comment: $ => seq($._block_comment_body, $._block_comment_end),
  },
}));

/**
 * @param {Record<string, SymbolRule>} rules
 * @param {boolean} multiline
 */
function javaStringContent(rules, multiline) {
  const fragment = multiline ? alias(rules._multiline_string_fragment, rules.multiline_string_fragment) : rules.string_fragment;
  const restrictedFragment = alias(
    multiline ? rules._non_u_multiline_string_fragment : rules._non_u_string_fragment,
    multiline ? rules.multiline_string_fragment : rules.string_fragment,
  );
  const escape = multiline ? alias(rules._text_block_escape_sequence, rules.escape_sequence) : rules.escape_sequence;
  const backslash = alias(rules._encoded_backslash_escape, rules.escape_sequence);
  return seq(
    repeat(choice(
      fragment,
      escape,
      rules.string_interpolation,
      seq(repeat1(backslash), choice(restrictedFragment, escape, rules.string_interpolation)),
    )),
    repeat(backslash),
  );
}

/** @param {boolean} multiline */
function javaStringEscape(multiline) {
  const unicodeCharacter = /\\u+([1-9a-fA-F][0-9a-fA-F]{3}|0[1-9a-fA-F][0-9a-fA-F]{2}|00[1346-9a-fA-F][0-9a-fA-F]|000[0-9bcefBCEF]|002[013-9a-fA-F]|005[0-9abd-fABD-F])/;
  const ordinary = choice(JAVA_ESCAPE, unicodeCharacter);
  return token.immediate(multiline ? choice(
    ordinary,
    /\\u+000[aAdD]/,
    seq('\\', /\r\n?|\n/),
    seq(JAVA_ENCODED_BACKSLASH, JAVA_LINE_TERMINATOR),
  ) : ordinary);
}


/**
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @returns {SeqRule}
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
 * @param {RuleOrLiteral} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * @param {RuleOrLiteral} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

function characterClass(ranges) {
  return `[${ranges.map(([start, end]) => start === end ? `\\u{${start.toString(16)}}` : `\\u{${start.toString(16)}}-\\u{${end.toString(16)}}`).join('')}]`;
}

function unicodeGrammar(result) {
  const {rules, reserved} = result.grammar;
  for (const [name, rule] of Object.entries(rules)) {
    if (!/(string|text_block|escape|character_literal)/.test(name)) {
      rules[name] = expandUnicodeRule(rule, name === 'identifier', rule.type === 'STRING');
    }
  }
  for (const [name, words] of Object.entries(reserved)) {
    reserved[name] = words.map(word => expandUnicodeRule(word, false, true));
  }
  return result;
}

function expandUnicodeRule(rule, identifier, lexical = false, keywords = true) {
  if (rule.type === 'STRING') {
    const content = {type: 'PATTERN', value: unicodeSpelling(rule.value, keywords)};
    return lexical ? content : {type: 'ALIAS', named: false, value: rule.value, content: {type: 'TOKEN', content}};
  }
  if (rule.type === 'PATTERN') {
    const atoms = rule.value.match(/\[(?:\\.|[^\]])*\]|\\.|./gu);
    return {...rule, value: atoms.map(atom => {
      if (/^[*+?]$/.test(atom)) return atom;
      const predicate = new RegExp(`^(?:${atom})$`, 'u');
      return `(?:${atom}|${encodedCharacters(predicate, identifier)})`;
    }).join('')};
  }
  const nestedLexical = lexical || rule.type === 'TOKEN' || rule.type === 'IMMEDIATE_TOKEN' || rule.type === 'ALIAS';
  const nestedKeywords = keywords && rule.type !== 'TOKEN' && rule.type !== 'IMMEDIATE_TOKEN';
  if (rule.content) return {...rule, content: expandUnicodeRule(rule.content, identifier, nestedLexical, nestedKeywords)};
  if (rule.members) return {...rule, members: rule.members.map(member => expandUnicodeRule(member, identifier, nestedLexical, nestedKeywords))};
  return rule;
}

function unicodeSpelling(value, keywords) {
  const word = keywords && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value);
  return [...value].map(character => unicodeCharacter(character) + (word && character !== '-' ? JAVA_KEYWORD_IGNORABLES : '')).join('');
}

function unicodeCharacter(character) {
  return `(?:${character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\\\u+${hexadecimalPattern([character.charCodeAt(0)])})`;
}

function encodedCharacters(predicate, identifier) {
  const bmp = [];
  const supplementary = new Map();
  const limit = identifier ? 0x10ffff : 0x7f;
  for (let code = 0; code <= limit; code++) {
    if (!predicate.test(String.fromCodePoint(code))) continue;
    if (code <= 0xffff) {
      bmp.push(code);
    } else {
      const high = 0xd800 + ((code - 0x10000) >> 10);
      const low = 0xdc00 + ((code - 0x10000) & 0x3ff);
      const values = supplementary.get(high) ?? [];
      values.push(low);
      supplementary.set(high, values);
    }
  }
  const alternatives = bmp.length ? [`\\\\u+${hexadecimalPattern(bmp)}`] : [];
  const lowGroups = new Map();
  for (const [high, low] of supplementary) {
    const pattern = hexadecimalPattern(low);
    const values = lowGroups.get(pattern) ?? [];
    values.push(high);
    lowGroups.set(pattern, values);
  }
  for (const [low, high] of lowGroups) alternatives.push(`\\\\u+${hexadecimalPattern(high)}\\\\u+${low}`);
  if (!alternatives.length) throw new Error(`No encoded characters for ${predicate}`);
  return alternatives.join('|');
}

function hexadecimalPattern(values, shift = 12) {
  if (shift < 0) return '';
  const prefixes = new Map();
  for (const value of values) {
    const digit = (value >> shift) & 15;
    const group = prefixes.get(digit) ?? [];
    group.push(value);
    prefixes.set(digit, group);
  }
  const suffixGroups = new Map();
  for (const [digit, group] of prefixes) {
    const suffix = hexadecimalPattern(group, shift - 4);
    const digits = suffixGroups.get(suffix) ?? [];
    const hex = digit.toString(16);
    digits.push(hex < 'a' ? hex : hex + hex.toUpperCase());
    suffixGroups.set(suffix, digits);
  }
  const alternatives = [...suffixGroups].map(([suffix, digits]) => {
    const characters = digits.join('');
    return (characters.length === 1 ? characters : `[${characters}]`) + suffix;
  });
  return alternatives.length === 1 ? alternatives[0] : `(?:${alternatives.join('|')})`;
}
