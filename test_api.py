"""
LiveDebug AI — Quick Test Script
Run: python test_api.py
Make sure the server is running on localhost:8000 first.
"""

import requests
import json

API = "http://localhost:8000"

# --- Sample errors for each language ---
SAMPLES = {
    "Python": '''Traceback (most recent call last):
  File "/Users/demo/app.py", line 42, in <module>
    main()
  File "/Users/demo/app.py", line 10, in main
    result = data["users"][0]["name"]
KeyError: 'users' ''',

    "JavaScript": '''TypeError: Cannot read properties of undefined (reading 'map')
    at renderList (/Users/demo/src/App.js:15:22)
    at Component.render (/Users/demo/src/App.js:8:5)''',

    "Java": '''Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()"
\tat com.example.Main.main(Main.java:12)''',

    "Go": '''panic: runtime error: index out of range [5] with length 3

goroutine 1 [running]:
main.main()
\t/Users/demo/main.go:8 +0x2f''',

    "Rust": '''error[E0382]: use of moved value: `data`
 --> src/main.rs:8:20
  |
5 |     let data = vec![1, 2, 3];
  |         ---- move occurs because `data` has type `Vec<i32>`
6 |     let data2 = data;
  |                 ---- value moved here
8 |     println!("{:?}", data);
  |                      ^^^^ value used here after move'''
}


def test_health():
    print("=" * 50)
    print("🏥 Health Check")
    print("=" * 50)
    r = requests.get(f"{API}/health")
    print(f"  Status: {r.status_code}")
    print(f"  Response: {r.json()}")
    print()


def test_analyze(lang, error_text):
    print(f"{'=' * 50}")
    print(f"🔍 Testing: {lang}")
    print(f"{'=' * 50}")

    r = requests.post(f"{API}/api/debug/analyze", json={"raw_output": error_text})

    if r.status_code == 200:
        data = r.json()
        print(f"  ✅ Error Type:  {data['error_type']}")
        print(f"  📄 File:        {data.get('file_path', 'N/A')}")
        print(f"  📍 Line:        {data.get('line_number', 'N/A')}")
        print(f"  💡 Explanation: {data['explanation'][:100]}...")
        print(f"  🔧 Fix:         {data['suggested_fix'][:100]}...")
        print(f"  📊 Confidence:  {data['confidence']}")
    else:
        print(f"  ❌ Error {r.status_code}: {r.json()}")
    print()


def test_invalid():
    print("=" * 50)
    print("🚫 Testing: Invalid input (no error)")
    print("=" * 50)
    r = requests.post(f"{API}/api/debug/analyze", json={"raw_output": "Hello world!"})
    print(f"  Status: {r.status_code} (expected 400)")
    print(f"  Response: {r.json()}")
    print()


if __name__ == "__main__":
    print()
    print("🐛 LiveDebug AI — API Test Suite")
    print("=" * 50)
    print()

    # 1. Health check
    test_health()

    # 2. Test all 5 languages
    for lang, error in SAMPLES.items():
        test_analyze(lang, error)

    # 3. Invalid input
    test_invalid()

    print("✅ All tests complete!")
    print()
