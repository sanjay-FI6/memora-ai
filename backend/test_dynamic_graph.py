import urllib.request
import json

test_cases = [
    (
        "Binary Search (Clean)",
        """def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1""",
        "python"
    ),
    (
        "Tree Traversal (Defect)",
        """void traverse(Node* root) {
    printf("%d", root->val);
    traverse(root->left);
}""",
        "c"
    ),
    (
        "Buffer Indexing",
        """int process(int arr[], int n) {
    for(int i = 0; i <= n; i++) {
        buffer[i] = arr[i];
    }
}""",
        "c"
    ),
    (
        "File I/O Leak",
        """void readData() {
    FILE* fp = fopen("data.txt", "r");
    char buf[100];
    fgets(buf, 100, fp);
}""",
        "c"
    )
]

for name, code, lang in test_cases:
    payload = {
        "submission_id": f"test-suite-{name.lower().replace(' ', '-').replace('(', '').replace(')', '')}",
        "user_code": code,
        "programming_language": lang
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request("http://127.0.0.1:8010/api/analyze", data=data, headers={"Content-Type": "application/json"})
    res = urllib.request.urlopen(req)
    out = json.loads(res.read())
    print(f"=== {name} ===")
    print("Detected Error:", out["error_clusters"][0]["title"])
    print("Nodes:", [f"{n['data']['label']} [{n['data']['status']}]" for n in out["nodes"]])
    print("Edges:", len(out["edges"]), "Animated edges:", sum(1 for e in out["edges"] if e.get("animated")))
    print()
