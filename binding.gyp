{
    "targets": [
        {
            "target_name": "node-pogo-signature-encrypt",
            "sources": [ "encrypt_src/encrypt.c", "encrypt_src/NativeExtension.cc", "encrypt_src/functions.cc" ],
            "include_dirs" : [
 	 			"<!(node -e \"require('nan')\")"
			]
        }
    ],
}
