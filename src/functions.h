#ifndef NATIVE_EXTENSION_GRAB_H
#define NATIVE_EXTENSION_GRAB_H

#include <nan.h>

extern "C" int encrypt(const unsigned char *input, size_t input_size, const unsigned char* iv, size_t iv_size, unsigned char* output, size_t * output_size);

NAN_METHOD(encrypt);

#endif
