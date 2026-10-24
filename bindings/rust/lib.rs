//! This crate provides Java language support for the [tree-sitter] parsing library.
//!
//! The parser carries the ABI number of the WillBooster fork (`0x5742000a`) and is tested with the
//! [`willbooster-tree-sitter`] runtime 14.0.4 (depend on it as
//! `tree-sitter = { package = "willbooster-tree-sitter", version = "14.0.0" }`). Runtimes with a different ABI,
//! including upstream's `tree-sitter` crate, reject it with a `LanguageError`.
//!
//! Typically, you will use the [`LANGUAGE`] constant to add this language to a
//! tree-sitter [`Parser`], and then use the parser to parse some code:
//!
//! ```
//! let code = "class Main {\n    int answer() {\n        return 42;\n    }\n}\n";
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_java::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Java parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [`Parser`]: https://docs.rs/willbooster-tree-sitter/14/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/
//! [`willbooster-tree-sitter`]: https://crates.io/crates/willbooster-tree-sitter

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_java() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_java) };

/// The content of the [`node-types.json`] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Java parser");
    }
}
