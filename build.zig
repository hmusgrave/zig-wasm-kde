const std = @import("std");
const Builder = std.build.Builder;
const builtin = @import("builtin");

pub fn build(b: *Builder) void {
    const mode = b.standardReleaseOptions();

    const wlib = b.addStaticLibrary("main", "src/main.zig");
    wlib.setBuildMode(mode);
    wlib.setTarget(.{ .cpu_arch = .wasm32, .os_tag = .freestanding });
    wlib.setOutputDir("zig-cache");

    var main_tests = b.addTest("src/kde.zig");
    main_tests.setBuildMode(mode);

    b.default_step.dependOn(&wlib.step);
    b.installDirectory(.{ .source_dir = "www", .install_dir = .Bin, .install_subdir = "" });
    b.installBinFile("zig-cache/main.wasm", "main.wasm");

    const test_step = b.step("test", "Run library tests");
    test_step.dependOn(&main_tests.step);
}
