const std = @import("std");
const Allocator = std.mem.Allocator;

// Imports from JS
extern fn __len(i: js_ptr) c_uint;
extern fn __pop(i: js_ptr) void;
extern fn __copy(i: js_ptr, ptr: c_uint) void;
extern fn consoleLog(msgPtr: *const u8, msgLen: c_uint) void;
extern fn sampleDat() js_ptr;

// Zig-ifying JS imports
const js_pop = __pop;
const js_arr_len = __len;
fn log(msg: []const u8) void {
    if (msg.len > 0)
        consoleLog(&msg[0], msg.len);
}
fn bufLog(comptime msg: []const u8, args: anytype) void {
    var buf: [512]u8 = undefined;
    log(std.fmt.bufPrint(&buf, msg, args) catch "");
}
fn js_copy(i: js_ptr, buf: []u8) void {
    if (buf.len > 0)
        __copy(i, @ptrToInt(&buf[0]));
}
fn data(allocator: *Allocator) ![]u8 {
    return try sampleDat().pop(allocator);
}

// - When JS provides a cache index holding a variable, we can
//   use a calling convention to copy that data to the WASM
//   memory space
// - Using non-exhaustive enum to get compiler enforced typdefs
const js_ptr = enum(c_uint) {
    _,

    pub fn pop(self: js_ptr, allocator: *Allocator) ![]u8 {
        var buf = try allocator.alloc(u8, js_arr_len(self));
        js_copy(self, buf);
        js_pop(self);
        return buf;
    }
};

export fn main() void {
    if (data(std.heap.page_allocator)) |a| {
        for (a) |item, idx| {
            bufLog("{}: {}\n", .{ idx, item });
        }
    } else |err| switch (err) {
        else => {},
    }
}
