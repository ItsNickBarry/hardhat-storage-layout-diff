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
