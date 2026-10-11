// KAOPU leather seed field, independently authored for this project, 2026-10-11.
// Non-cryptographic, 32-bit integer construction. This is NOT hash12 or a
// scalarized/relabelled version of the former floating-point hash function.
// The recipe seed and floating coordinate words key a four-round ARX network.
// Domain words are ASCII "KAOP" and "ULEA"; round strides are small odd numbers.
precision highp int;
uint kaopuRotateWord(uint word, uint shift) {
    return (word << shift) | (word >> (32u - shift));
}
uint kaopuSeedWord(vec2 coordinate, float recipeSeed) {
    uvec2 words = floatBitsToUint(coordinate + vec2(0.0));
    uint left = words.x ^ 0x4b414f50u;
    uint right = words.y ^ floatBitsToUint(recipeSeed + 0.0) ^ 0x554c4541u;
    for (uint roundIndex = 0u; roundIndex < 4u; ++roundIndex) {
        left += kaopuRotateWord(right, 5u) + 2039u * (roundIndex + 1u);
        right ^= kaopuRotateWord(left, 17u);
        left *= 12289u;
        right += kaopuRotateWord(left, 11u) + 4093u;
        uint nextLeft = right;
        right = left ^ kaopuRotateWord(right, 23u);
        left = nextLeft;
    }
    return left ^ kaopuRotateWord(right, 13u);
}
float h(vec2 coordinate) {
    return float(kaopuSeedWord(coordinate, uSeed) >> 8u) * (1.0 / 16777216.0);
}
