#include "functions.h"
#include <iostream>
#include "v8.h"
#include <string.h>

using namespace std;
using namespace v8;
using namespace node;

NAN_METHOD(encryptMethod) {
    // Validate things
    if (info.Length() < 3) return;
    if (!info[2]->IsFunction()) return;

    // register our callback, maybe add sync version later if no callback passed?
    Nan::Callback callback(Local<Function>::Cast(info[2]));

    //validate our input buffers
    if (info[0].IsEmpty() || !info[0]->IsObject()){
        Local<Value> argv[1] = { Nan::New<String>("arg 1 (input) is empty or not a Buffer").ToLocalChecked() };
        callback.Call(1, argv);
        return;
    }

    if (info[1].IsEmpty() || !info[1]->IsObject()){
        Local<Value> argv[1] = { Nan::New<String>("arg 2 (init vector) is empty or not a Buffer").ToLocalChecked() };
        callback.Call(1, argv);
        return;
    }

    // read our input buffers
    Local<Object> inputBuffer = info[0]->ToObject();
    size_t inputLen = Buffer::Length(inputBuffer);
    unsigned char* input = new unsigned char[inputLen + 1];
    memcpy((void*)input, (void*)Buffer::Data(inputBuffer), inputLen);
    input[inputLen] = 0;

    Local<Object> ivBuffer = info[1]->ToObject();
    size_t ivLen = Buffer::Length(ivBuffer);
    unsigned char* iv = new unsigned char[ivLen + 1];
    memcpy((void*)iv, (void*)Buffer::Data(ivBuffer), ivLen);
    iv[ivLen] = 0;

    // get our output len (could just do it here)
    size_t outputLen;
    if (encryptMethod(input, (size_t)inputLen, iv, (size_t)ivLen, NULL, &outputLen) != 0) {
        delete input;
        delete iv;
        Local<Value> argv[1] = { Nan::New<String>("encrypt validation failed (iv length must be 32)").ToLocalChecked() };
        callback.Call(1, argv);
        return;
    }

    // encrypt
    unsigned char* output = new unsigned char[outputLen];
    int code = encryptMethod(input, (size_t)inputLen, iv, (size_t)ivLen, output, &outputLen);

    delete input;
    delete iv;

    // handle error
    if (code != 0) {
        Local<Value> argv[1] = { Nan::ErrnoException(code, NULL, "encrypt call did not return 0") };
        callback.Call(1, argv);
        return;
    }

    // Call our callback
    Local<Value> argv[2] = { Nan::Null(), Nan::NewBuffer((char*)output, (int)outputLen).ToLocalChecked() };
    callback.Call(2, argv);
}
