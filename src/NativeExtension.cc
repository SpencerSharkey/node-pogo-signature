#include "functions.h"

using v8::FunctionTemplate;

NAN_MODULE_INIT(InitAll) {
    Nan::Set(target, Nan::New("encrypt").ToLocalChecked(), Nan::GetFunction(Nan::New<FunctionTemplate>(encrypt)).ToLocalChecked());
}

NODE_MODULE(NativeExtension, InitAll)
