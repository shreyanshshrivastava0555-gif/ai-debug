import unittest
from debugging.error_parser import ErrorParser

class TestErrorParser(unittest.TestCase):
    def setUp(self):
        self.parser = ErrorParser()

    def test_python_error(self):
        raw = '''Traceback (most recent call last):
  File "/Users/demo/app.py", line 42, in <module>
    main()
  File "/Users/demo/app.py", line 10, in main
    raise ValueError("Bad value")
ValueError: Bad value'''
        res = self.parser.parse(raw)
        self.assertEqual(res["language"], "python")
        self.assertEqual(res["error_type"], "ValueError")
        self.assertEqual(res["error_message"], "Bad value")
        self.assertEqual(res["file_path"], "/Users/demo/app.py")
        self.assertEqual(res["line_number"], 10)

    def test_javascript_error(self):
        raw = '''TypeError: Cannot read properties of undefined (reading 'x')
    at processData (/Users/demo/index.js:15:22)
    at main (/Users/demo/index.js:5:5)'''
        res = self.parser.parse(raw)
        self.assertEqual(res["language"], "javascript")
        self.assertEqual(res["error_type"], "TypeError")
        self.assertEqual(res["error_message"], "Cannot read properties of undefined (reading 'x')")
        self.assertEqual(res["file_path"], "/Users/demo/index.js")
        self.assertEqual(res["line_number"], 15)

    def test_java_error(self):
        raw = '''Exception in thread "main" java.lang.NullPointerException: Cannot invoke
	at com.example.Main.main(Main.java:12)'''
        res = self.parser.parse(raw)
        self.assertEqual(res["language"], "java")
        self.assertEqual(res["error_type"], "NullPointerException")
        self.assertEqual(res["file_path"], "Main.java")
        self.assertEqual(res["line_number"], 12)

    def test_go_error(self):
        raw = '''panic: runtime error: index out of range [1] with length 1

goroutine 1 [running]:
main.main()
	/Users/demo/main.go:5 +0x1b'''
        res = self.parser.parse(raw)
        self.assertEqual(res["language"], "go")
        self.assertEqual(res["error_type"], "panic")
        self.assertEqual(res["error_message"], "runtime error: index out of range [1] with length 1")
        self.assertEqual(res["file_path"], "/Users/demo/main.go")
        self.assertEqual(res["line_number"], 5)

    def test_rust_error(self):
        raw = '''error[E0382]: use of moved value: `s`
 --> src/main.rs:4:20
  |
2 |     let s = String::from("hello");
  |         - move occurs because `s` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s;
  |              - value moved here
4 |     println!("{}", s);
  |                    ^ value used here after move'''
        res = self.parser.parse(raw)
        self.assertEqual(res["language"], "rust")
        self.assertEqual(res["error_type"], "CompileError(E0382)")
        self.assertEqual(res["error_message"], "use of moved value: `s`")
        self.assertEqual(res["file_path"], "src/main.rs")
        self.assertEqual(res["line_number"], 4)

if __name__ == '__main__':
    unittest.main()
