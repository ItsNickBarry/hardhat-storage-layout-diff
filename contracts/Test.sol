// SPDX-License-Identifier: UNLICENSED
pragma solidity *;

contract Test {
    enum E {
        ONE,
        TWO
    }

    struct Struct {
        address a;
        E e;
        address b;
        E f;
    }

    Struct str;
    mapping(address => bool) map;
    uint128[5] five;
    bool b0;
    bool b1;
    bool[4][2] bools;
}

contract Test2 {
    bytes29 _b;
    uint128 a;
    uint64 b;
    uint128 u;
}

contract Test3 {
    bytes30 _b;
    uint64 a;
    uint128 b;
    uint128 u;
    uint64 uu;
}
