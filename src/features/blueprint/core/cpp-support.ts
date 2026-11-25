import type { Binary, SecurityUnary, Unary } from "./ir";

export const cppBinary: Record<Exclude<Binary, "and" | "or">, string> = {
  add: "add",
  subtract: "subtract",
  multiply: "multiply",
  divide: "divide",
  modulo: "modulo",
  power: "power",
  minimum: "minimum",
  maximum: "maximum",
  equal: "equal",
  notEqual: "not_equal",
  greater: "greater",
  less: "less",
  atLeast: "at_least",
  atMost: "at_most",
  xor: "not_equal",
  concat: "concat",
};
export const cppUnary: Record<Exclude<Unary, SecurityUnary>, string> = {
  not: "negate",
  string: "to_string",
  number: "to_number",
  boolean: "to_boolean",
  round: "round",
  floor: "floor",
  ceil: "ceil",
  sqrt: "sqrt",
  abs: "abs",
  length: "length",
  upper: "upper",
  lower: "lower",
  trim: "trim",
  json: "serialize",
};

export const cppSupport = String.raw`#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <initializer_list>
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#else
#include <thread>
#endif

// Blueprint values and built-in operations.
namespace bp {
struct Value;
struct Array;
struct Object;

struct Value {
    enum Kind { Undefined, Null, Boolean, Number, String, List, Record, Address };
    Kind kind = Undefined;
    bool flag = false;
    double numeric = 0;
    std::string text;
    std::shared_ptr<Array> items;
    std::shared_ptr<Object> entries;
    Value* target = nullptr;

    Value() = default;
    Value(std::nullptr_t) : kind(Null) {}
    Value(bool value) : kind(Boolean), flag(value) {}
    Value(double value) : kind(Number), numeric(value) {}
    Value(std::string value) : kind(String), text(std::move(value)) {}
};

struct Array { std::vector<Value> values; };
struct Object { std::vector<std::pair<std::string, Value>> fields; };

inline Value array(std::initializer_list<Value> items) {
    Value result;
    result.kind = Value::List;
    result.items = std::make_shared<Array>(Array{items});
    return result;
}
inline Value object(std::initializer_list<std::pair<std::string, Value>> fields) {
    Value result;
    result.kind = Value::Record;
    result.entries = std::make_shared<Object>(Object{fields});
    return result;
}
inline Value pointer(Value* target, const std::string& type = "") {
    Value result;
    result.kind = Value::Address;
    result.target = target;
    result.text = type;
    return result;
}
inline Value reference(Value& target, const std::string& type) { return pointer(&target, type); }
inline bool is_null_address(const Value& address) { return address.target == nullptr; }
inline Value& dereference(const Value& address) {
    if (is_null_address(address)) throw std::runtime_error("This pointer or reference has no variable target.");
    return *address.target;
}
inline const char* value_type(const Value& value) {
    static const char* names[] = { "undefined", "null", "boolean", "number", "string", "array", "object", "pointer" };
    return names[value.kind];
}
inline const Value& read_address(const Value& address, const std::string& type) {
    const auto& value = dereference(address);
    if (type != "any" && type != value_type(value))
        throw std::runtime_error("This alias does not contain a " + type + " value.");
    return value;
}
inline void write_address(const Value& address, const Value& value) {
    if (!address.text.empty() && address.text != "any" && address.text != value_type(value))
        throw std::runtime_error("This alias expects a " + address.text + " value.");
    dereference(address) = value;
}
inline Value copy_value(const Value& value) {
    Value result = value;
    if (value.kind == Value::List) {
        result.items = std::make_shared<Array>();
        for (const auto& item : value.items->values) result.items->values.push_back(copy_value(item));
    } else if (value.kind == Value::Record) {
        result.entries = std::make_shared<Object>();
        for (const auto& field : value.entries->fields) result.entries->fields.emplace_back(field.first, copy_value(field.second));
    }
    return result;
}
struct Class {
    std::string name;
    Value fields;
    Value instantiate() const {
        if (fields.kind != Value::Record) throw std::runtime_error("Define Class needs an object for its default fields.");
        return copy_value(fields);
    }
};
inline bool truth(const Value& value) {
    switch (value.kind) {
        case Value::Undefined: case Value::Null: return false;
        case Value::Boolean: return value.flag;
        case Value::Number: return value.numeric != 0 && !std::isnan(value.numeric);
        case Value::String: return !value.text.empty();
        default: return true;
    }
}
inline std::string number_text(double value) {
    if (std::isnan(value)) return "NaN";
    if (std::isinf(value)) return value < 0 ? "-Infinity" : "Infinity";
    if (value == 0) return "0";
    std::ostringstream out;
    out << std::setprecision(15) << value;
    return out.str();
}
inline std::string string(const Value& value) {
    switch (value.kind) {
        case Value::Undefined: return "undefined";
        case Value::Null: return "null";
        case Value::Boolean: return value.flag ? "true" : "false";
        case Value::Number: return number_text(value.numeric);
        case Value::String: return value.text;
        case Value::Record: return "[object Object]";
        case Value::Address: return "[address]";
        case Value::List: {
            std::string result;
            bool first = true;
            for (const auto& item : value.items->values) {
                if (!first) result += ',';
                first = false;
                if (item.kind != Value::Null && item.kind != Value::Undefined) result += string(item);
            }
            return result;
        }
    }
    return {};
}
inline std::string trimmed(const std::string& value) {
    auto start = value.find_first_not_of(" \t\r\n\f\v");
    if (start == std::string::npos) return {};
    return value.substr(start, value.find_last_not_of(" \t\r\n\f\v") - start + 1);
}
inline double number(const Value& value) {
    switch (value.kind) {
        case Value::Null: return 0;
        case Value::Boolean: return value.flag ? 1 : 0;
        case Value::Number: return value.numeric;
        case Value::String: case Value::List: {
            const auto text = trimmed(string(value));
            if (text.empty()) return 0;
            char* end = nullptr;
            const double result = std::strtod(text.c_str(), &end);
            if (end == text.c_str() + text.size()) return result;
            return std::numeric_limits<double>::quiet_NaN();
        }
        default: return std::numeric_limits<double>::quiet_NaN();
    }
}
inline bool same(const Value& left, const Value& right) {
    if (left.kind != right.kind) return false;
    switch (left.kind) {
        case Value::Boolean: return left.flag == right.flag;
        case Value::Number: return left.numeric == right.numeric;
        case Value::String: return left.text == right.text;
        case Value::List: return left.items == right.items;
        case Value::Record: return left.entries == right.entries;
        default: return true;
    }
}
inline std::string quote(const std::string& text) {
    const char* hex = "0123456789abcdef";
    std::string result = "\"";
    for (unsigned char ch : text) {
        switch (ch) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\b': result += "\\b"; break;
            case '\f': result += "\\f"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (ch < 32) {
                    result += "\\u00";
                    result += hex[ch >> 4];
                    result += hex[ch & 15];
                } else result += static_cast<char>(ch);
        }
    }
    return result + '"';
}
inline std::string json(const Value& value) {
    if (value.kind == Value::List) {
        std::string result = "[";
        for (const auto& item : value.items->values) {
            if (result.size() > 1) result += ',';
            result += item.kind == Value::Undefined ? "null" : json(item);
        }
        return result + ']';
    }
    if (value.kind == Value::Record) {
        std::string result = "{";
        for (const auto& field : value.entries->fields) {
            if (field.second.kind == Value::Undefined) continue;
            if (result.size() > 1) result += ',';
            result += quote(field.first) + ':' + json(field.second);
        }
        return result + '}';
    }
    if (value.kind == Value::String) return quote(value.text);
    if (value.kind == Value::Number && !std::isfinite(value.numeric)) return "null";
    return string(value);
}
inline std::vector<Value> list(const Value& value) {
    if (value.kind != Value::List) throw std::runtime_error("Expected an array.");
    return value.items->values;
}
inline Value property(const Value& value, const Value& key) {
    if (value.kind == Value::Record) {
        for (const auto& field : value.entries->fields) {
            if (field.first == string(key)) return field.second;
        }
    } else if (value.kind == Value::List && key.kind == Value::Number) {
        const double index = key.numeric;
        if (index >= 0 && index < static_cast<double>(value.items->values.size()) && std::floor(index) == index)
            return value.items->values[static_cast<std::size_t>(index)];
    }
    return {};
}
inline void set_field(const Value& object, const Value& key, const Value& value) {
    if (object.kind != Value::Record) throw std::runtime_error("Set Field expects an object or instance.");
    const auto name = string(key);
    auto copy = copy_value(value);
    for (auto& field : object.entries->fields) {
        if (field.first == name) {
            field.second = std::move(copy);
            return;
        }
    }
    object.entries->fields.emplace_back(name, std::move(copy));
}
inline void print(const Value& value) {
    std::cout << (value.kind == Value::List || value.kind == Value::Record ? json(value) : string(value)) << '\n';
}
inline void delay(const Value& value) {
    const double ms = std::max(0.0, std::min(number(value), 1000.0));
#ifdef _WIN32
    Sleep(static_cast<DWORD>(ms));
#else
    std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(ms)));
#endif
}
inline Value equal(const Value& a, const Value& b) { return same(a, b); }
inline Value not_equal(const Value& a, const Value& b) { return !same(a, b); }
inline Value add(const Value& a, const Value& b) { return number(a) + number(b); }
inline Value subtract(const Value& a, const Value& b) { return number(a) - number(b); }
inline Value multiply(const Value& a, const Value& b) { return number(a) * number(b); }
inline Value divide(const Value& a, const Value& b) { return number(a) / number(b); }
inline Value modulo(const Value& a, const Value& b) { return std::fmod(number(a), number(b)); }
inline Value power(const Value& a, const Value& b) { return std::pow(number(a), number(b)); }
inline Value minimum(const Value& a, const Value& b) {
    const double left = number(a), right = number(b);
    if (std::isnan(left) || std::isnan(right)) return std::numeric_limits<double>::quiet_NaN();
    if (left == 0 && right == 0) return std::signbit(left) || std::signbit(right) ? -0.0 : 0.0;
    return std::min(left, right);
}
inline Value maximum(const Value& a, const Value& b) {
    const double left = number(a), right = number(b);
    if (std::isnan(left) || std::isnan(right)) return std::numeric_limits<double>::quiet_NaN();
    if (left == 0 && right == 0) return std::signbit(left) && std::signbit(right) ? -0.0 : 0.0;
    return std::max(left, right);
}
inline Value greater(const Value& a, const Value& b) { return number(a) > number(b); }
inline Value less(const Value& a, const Value& b) { return number(a) < number(b); }
inline Value at_least(const Value& a, const Value& b) { return number(a) >= number(b); }
inline Value at_most(const Value& a, const Value& b) { return number(a) <= number(b); }
inline Value concat(const Value& a, const Value& b) { return string(a) + string(b); }
inline Value negate(const Value& value) { return !truth(value); }
inline Value to_string(const Value& value) { return string(value); }
inline Value to_number(const Value& value) { return number(value); }
inline Value to_boolean(const Value& value) { return truth(value); }
inline Value round(const Value& value) { return std::floor(number(value) + 0.5); }
inline Value floor(const Value& value) { return std::floor(number(value)); }
inline Value ceil(const Value& value) { return std::ceil(number(value)); }
inline Value sqrt(const Value& value) { return std::sqrt(number(value)); }
inline Value abs(const Value& value) { return std::fabs(number(value)); }
inline Value length(const Value& value) {
    if (value.kind == Value::List) return static_cast<double>(value.items->values.size());
    double units = 0;
    for (unsigned char ch : value.text) {
        if ((ch & 0xc0) != 0x80) units += ch >= 0xf0 ? 2 : 1;
    }
    return units;
}
inline Value upper(const Value& value) {
    auto result = value.text;
    for (auto& ch : result) if (ch >= 'a' && ch <= 'z') ch -= 'a' - 'A';
    return result;
}
inline Value lower(const Value& value) {
    auto result = value.text;
    for (auto& ch : result) if (ch >= 'A' && ch <= 'Z') ch += 'a' - 'A';
    return result;
}
inline Value trim(const Value& value) { return trimmed(value.text); }
inline Value serialize(const Value& value) { return json(value); }
}
`;
