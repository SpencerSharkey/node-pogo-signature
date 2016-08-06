{
    "targets": [
        {
            "target_name": "node-pogo-signature",
            "sources": [ "src/encrypt.c", "src/NativeExtension.cc", "src/functions.cc" ],
            "include_dirs" : [
 	 			"<!(node -e \"require('nan')\")"
			]
        }
    ],
}
