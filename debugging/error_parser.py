"""
LiveDebug AI — Error Parser
Parses raw terminal output into structured error data.
Supports: Python, JavaScript/Node.js, Java, Go, Rust, C/C++
"""

import re
from typing import Optional


class ErrorParser:

    PATTERNS = {
        "python": {
            # Traceback (most recent call last): ... SomeError: message
            "traceback": re.compile(
                r'Traceback \(most recent call last\):\n(.*?)^(\w+(?:\.\w+)*Error|Exception): (.+)',
                re.MULTILINE | re.DOTALL
            ),
            "file_line": re.compile(r'File "(.+?)", line (\d+)'),
            "error_type": re.compile(r'^(\w+(?:\.\w+)*(?:Error|Exception|Warning)): (.+)', re.MULTILINE),
        },
        "javascript": {
            # TypeError: Cannot read property 'x' of undefined\n  at fn (file.js:10:5)
            "error_type": re.compile(r'^(\w+Error|Error): (.+)', re.MULTILINE),
            "file_line": re.compile(r'at .+? \((.+?):(\d+):\d+\)'),
            "node_error": re.compile(r'node:(.+?):(\d+)'),
        },
        "java": {
            # Exception in thread "main" java.lang.NullPointerException
            "error_type": re.compile(r'Exception in thread ".+?" ([\w.]+Exception|[\w.]+Error): (.*)'),
            "file_line": re.compile(r'at [\w.$]+\(([\w]+\.java):(\d+)\)'),
        },
        "go": {
            "panic": re.compile(r'panic: (.+)'),
            "file_line": re.compile(r'\t(.+\.go):(\d+)'),
        },
        "rust": {
            "error": re.compile(r'^error(?:\[(\w+)\])?: (.+)', re.MULTILINE),
            "file_line": re.compile(r'--> (.+):(\d+):\d+'),
        },
    }

    def detect_language(self, raw_output: str) -> str:
        """Auto-detect language from error output if not provided."""
        if "Traceback (most recent call last)" in raw_output:
            return "python"
        if re.search(r'\w+Error:.*\n\s+at ', raw_output):
            return "javascript"
        if "Exception in thread" in raw_output:
            return "java"
        if "goroutine" in raw_output and "panic" in raw_output:
            return "go"
        if re.search(r'^error\[E\d+\]', raw_output, re.MULTILINE):
            return "rust"
        return "unknown"

    def parse(self, raw_output: str, language: Optional[str] = None) -> Optional[dict]:
        """
        Parse raw terminal output and return structured error dict.
        Returns None if no error is detected.
        """
        lang = language or self.detect_language(raw_output)
        patterns = self.PATTERNS.get(lang, {})

        result = {
            "raw": raw_output,
            "language": lang,
            "error_type": "UnknownError",
            "error_message": "",
            "file_path": None,
            "line_number": None,
            "stack_trace": [],
        }

        if lang == "python":
            return self._parse_python(raw_output, result)
        elif lang == "javascript":
            return self._parse_javascript(raw_output, result)
        elif lang == "java":
            return self._parse_java(raw_output, result)
        elif lang == "go":
            return self._parse_go(raw_output, result)
        elif lang == "rust":
            return self._parse_rust(raw_output, result)
        else:
            # Generic fallback: look for any "Error:" pattern
            return self._parse_generic(raw_output, result)

    def _parse_python(self, output: str, result: dict) -> Optional[dict]:
        # Extract error type and message
        error_match = re.search(
            r'^(\w+(?:\.\w+)*(?:Error|Exception|Warning)): (.+)', output, re.MULTILINE
        )
        if not error_match:
            return None

        result["error_type"] = error_match.group(1)
        result["error_message"] = error_match.group(2).strip()

        # Extract file and line from last File reference before the error
        file_matches = list(re.finditer(r'File "(.+?)", line (\d+)', output))
        if file_matches:
            last = file_matches[-1]
            result["file_path"] = last.group(1)
            result["line_number"] = int(last.group(2))

        # Collect full stack trace
        result["stack_trace"] = re.findall(r'File ".+?", line \d+, in .+', output)

        return result

    def _parse_javascript(self, output: str, result: dict) -> Optional[dict]:
        error_match = re.search(r'^(\w+Error|Error|TypeError|ReferenceError|SyntaxError): (.+)', output, re.MULTILINE)
        if not error_match:
            return None

        result["error_type"] = error_match.group(1)
        result["error_message"] = error_match.group(2).strip()

        file_match = re.search(r'at .+? \((.+?):(\d+):\d+\)', output)
        if file_match:
            result["file_path"] = file_match.group(1)
            result["line_number"] = int(file_match.group(2))

        result["stack_trace"] = re.findall(r'^\s+at .+', output, re.MULTILINE)
        return result

    def _parse_java(self, output: str, result: dict) -> Optional[dict]:
        error_match = re.search(
            r'([\w.]+(?:Exception|Error))(?:: (.*))?', output
        )
        if not error_match:
            return None

        result["error_type"] = error_match.group(1).split(".")[-1]  # Short name
        result["error_message"] = (error_match.group(2) or "").strip()

        file_match = re.search(r'at [\w.$]+\(([\w]+\.java):(\d+)\)', output)
        if file_match:
            result["file_path"] = file_match.group(1)
            result["line_number"] = int(file_match.group(2))

        result["stack_trace"] = re.findall(r'^\s+at .+', output, re.MULTILINE)
        return result

    def _parse_go(self, output: str, result: dict) -> Optional[dict]:
        panic_match = re.search(r'panic: (.+)', output)
        if not panic_match:
            return None

        result["error_type"] = "panic"
        result["error_message"] = panic_match.group(1).strip()

        file_match = re.search(r'\t(.+\.go):(\d+)', output)
        if file_match:
            result["file_path"] = file_match.group(1)
            result["line_number"] = int(file_match.group(2))

        return result

    def _parse_rust(self, output: str, result: dict) -> Optional[dict]:
        error_match = re.search(r'^error(?:\[(\w+)\])?: (.+)', output, re.MULTILINE)
        if not error_match:
            return None

        result["error_type"] = f"CompileError({error_match.group(1)})" if error_match.group(1) else "CompileError"
        result["error_message"] = error_match.group(2).strip()

        file_match = re.search(r'--> (.+):(\d+):\d+', output)
        if file_match:
            result["file_path"] = file_match.group(1)
            result["line_number"] = int(file_match.group(2))

        return result

    def _parse_generic(self, output: str, result: dict) -> Optional[dict]:
        error_match = re.search(r'(\w*[Ee]rror\w*)[:\s]+(.+)', output)
        if not error_match:
            return None

        result["error_type"] = error_match.group(1)
        result["error_message"] = error_match.group(2).strip()
        return result
