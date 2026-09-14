load("@rules_python//python:defs.bzl", "py_binary", "py_library")

py_library(
    name = "webpage-chatbot",
    srcs = ["analyze.py"],
    visibility = ["//:__subpackages__"],
    deps = [
        "@pip//numpy",
        "@pip//scipy",
    ],
)

py_binary(
    name = "analyze",
    srcs = ["analyze.py"],
    visibility = ["//:__subpackages__"],
    deps = [
        ":server",
        "@pip//numpy",
        "@pip//scipy",
    ],
)

py_library(
    name = "server",
    srcs = [
        "__init__.py",
        "analyze.py",
        "do_something.py",
    ],
    visibility = ["//:__subpackages__"],
    deps = [
        "@pip//numpy",
        "@pip//scipy",
    ],
)
