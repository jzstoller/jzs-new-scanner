import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				sourceType: "module",
			},
			globals: {
				node: true,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			obsidianmd,
		},
		rules: {
			...tseslint.configs["eslint-recommended"].overrides?.[0]?.rules,
			...tseslint.configs["recommended"].rules,
			...obsidianmd.configs.recommended.rules,
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"obsidianmd/sample-names": "off",
		},
	},
];
