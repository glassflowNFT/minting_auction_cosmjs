const { calculateFee, GasPrice } = require("@cosmjs/stargate");
const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { SigningCosmWasmClient, CosmWasmClient } = require("@cosmjs/cosmwasm-stargate");
const _ = require("fs");

const rpcEndpoint = "https://rpc.cliffnet.cosmwasm.com:443";

// Example user from scripts/wasmd/README.md
const sender = {
    mnemonic: "rare race capable trend seven pilot silent couple battle zone camera clarify laundry fix ship citizen good crater ribbon cloud journey paddle bulk much",
    address: "wasm1mgl5svtz8sy3s6aavx9589txu789djd0ewsqdl",
};

const recipient = {
    mnemonic: "target below announce scorpion six broccoli viable tail dance leave cradle young rescue brick merry mean duty because clog hat shop hub that enter",
    address: "wasm1km7eq7csp9my73994c5c8m5hec4wkl9mnsyf0q",
};

const arbiter = {
    mnemonic: "oblige apple beef tomato husband bacon nothing monster tell phone able grunt purchase manage exotic scrap fish plunge zone rose device dove bid bar",
    address: "wasm12z2lfyv4297tzs0ck3taswfesx86x78rypm30l",
};

function objectToBase64(input) {
    const stringified = JSON.stringify(input)
    return Buffer.from(stringified).toString('base64')
}

async function main() {
    // const escrowWasmPath =  "./cw_escrow.wasm";
    const gasPrice = GasPrice.fromString("0.05upebble");

    // Upload contract
    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);
    const wasm = _.readFileSync(escrowWasmPath);
    const uploadFee = calculateFee(2_000_000, gasPrice);
    const uploadReceipt = await sender_client.upload(sender.address, wasm, uploadFee, "Upload hackatom contract");
    console.log("Upload succeeded. Receipt:", uploadReceipt);

    // Instantiate
    const instantiateFee = calculateFee(500_000, gasPrice);
	const msg = {} ;
    const { contractAddress } = await sender_client.instantiate(
        sender.address,
        uploadReceipt.codeId,
        msg,
        "My instance",
        instantiateFee,
        { memo: `Create a hackatom instance` },
    );
    console.info(`Contract instantiated at: `, contractAddress);

    // const contractAddress = "wasm16g5nklyw9ztcmkpnx0qxara0md6xqdkv7ck2cm339fwcanv87fcq7t27td";
    // Create escrow contract
    const executeFee = calculateFee(300_000, gasPrice);
    const escrow_id = "random";
    const create_result = await sender_client.execute(
        sender.address, 
        contractAddress,  
        {
            create: {
                arbiter: arbiter.address, 
                recipient: recipient.address, 
                id: escrow_id,
            }
        }, 
        executeFee,
        "",
        [{denom: "upebble", amount: "10000"}]
    );

    console.info("escrow create execution result: ", create_result);

    // Approve
    const arbiter_wallet = await DirectSecp256k1HdWallet.fromMnemonic(arbiter.mnemonic, { prefix: "wasm" });
    const arbiter_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, arbiter_wallet);
    const approve_result = await arbiter_client.execute(
        arbiter.address, 
        contractAddress,  
        {
            approve: {
                id: escrow_id,
            }
        }, 
        executeFee,
    );
    console.info("escrow approve result: ", approve_result);

    // escrow with cw20
    const escrow_id1 = "random1";
    const create_msg = {            
        create: {
            arbiter: arbiter.address, 
            recipient: recipient.address, 
            id: escrow_id1,
        }
    };
    const create_result1 = await sender_client.execute(
        sender.address,  // token address
        contractAddress,  
        {
            receive: {
                amount: "10_000_000", 
                msg: Buffer.from(create_msg, 'base64'),
                sender: sender.address,
            }
        }, 
        executeFee,
    );

    console.info("escrow create execution result: ", create_result1);

	// query
	const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(contractAddress, {details:{id: "random"}});
	console.info("query result", query_result);
}

const uploadContract = async (wasmPath) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    // Upload contract
    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);
    const wasm = _.readFileSync(wasmPath);
    const uploadFee = calculateFee(2_500_000, gasPrice);
    const uploadReceipt = await sender_client.upload(sender.address, wasm, uploadFee, "Upload hackatom contract");
    console.log("Upload succeeded. Receipt:", uploadReceipt);

    return uploadReceipt.codeId;
}

const instantiate = async (codeId, msg) => {
    // Upload contract
    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);
    const gasPrice = GasPrice.fromString("0.05upebble");
    const instantiateFee = calculateFee(500_000, gasPrice);
    const { contractAddress } = await sender_client.instantiate(
        sender.address,
        codeId,
        msg,
        "My instance",
        instantiateFee,
        { memo: `Create a hackatom instance` },
    );
    console.info(`Contract instantiated at: `, contractAddress);
    return contractAddress;
};
// main();

const cw721_deploy = async (minterAddress) => {
    const codeId = await uploadContract( "./cw721_base.wasm");
    const cw721_address = await instantiate( 
        codeId, 
        { 
            "name": "glassflow_nft",  
            "symbol": "GF", 
            "minter": minterAddress
        }); 

    return cw721_address;
}

const auction_deploy = async () => {
    const codeId = await uploadContract( "./cw_auction.wasm");
    const contractAddress = await instantiate( codeId, {});
    return contractAddress;
}

const updateMinters = async (contractAddress) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(300_000, gasPrice);
    const escrow_id = "random";
    const create_result = await sender_client.execute(
        sender.address, 
        contractAddress,  
        {
            update_minter: {
                minter: sender.address, 
            }
        }, 
        executeFee,
        "",
        [{denom: "upebble", amount: "10000"}]
    );
    console.log("res: ", create_result);
}

const setNftAddress = async (contract_address, cw721_address) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(300_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contract_address,  
        {
            set_nft_address: {
                nft_address: cw721_address,  //nft address
            }
        }, 
        executeFee,
        "",
        [{denom: "upebble", amount: "10000"}]
    );
    console.log("res: ", create_result);
}

const mint = async (contractAddress) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(300_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contractAddress,  
        {
            mint: {
                // msg: {
                    "collection": "1",
                    "description": "glassflow nfts",
                    "external_link": "https://external",
                    "image_uri": "https://image/image.png",
                    "init_price": "10000",
                    "name": "mynft",
                    "num_nfts": "1",
                    "num_real_repr": "1",
                    "owner": contractAddress,
                    "royalties": [
                        {
                            "address": sender.address,
                            "royalty_rate": "0.1"
                        },
                        {
                            "address": recipient.address,
                            "royalty_rate": "0.2"
                        }
                    ]
                // }
            }
        }, 
        executeFee,
        "",
        [] //
    );
    // console.log("res: ", create_result.logs[0].events[2].attributes);
}


const queryMinters = async (contractAddress) => {
    const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(contractAddress, {"query_minter": {}} );
	console.info("query result", query_result);
}

const queryNFTInfo = async (contractAddress) => {
    const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(
        contractAddress, 
        {
            "query_nft_info": {
                "token_id": "GF.1",
            }
        } );
	console.info("query result", query_result);

}

const queryNFTIds = async (contractAddress) => {
    const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(
        contractAddress, 
        {
            "all_tokens": { }
        } );
	console.info("query result", query_result);
}

// const contractAddress = "wasm1sxywggndhctyh6y78tkx6pzehfv85hvgf02n5z5y38skwcats8zqcs9qtq";

const placeListing = async (contract_address) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(400_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contract_address,  
        {
            place_listing: {
                id: "GF.1",  //nft address
                minimum_bid: {
                    amount: "10000",
                    info: {
                        // token: {
                        //     contract_addr: "terraxxx"
                        // },
                        native_token: {
                            denom: "upebble"
                        }
                    },
                }
            }
        },
        executeFee,
        "",
        []
    );
    console.log("res: ", create_result);
}

const bidListing = async (contract_address) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(400_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contract_address,  
        {
            bid_listing: {
                listing_id: "AUCTION.1",  //nft address
                bid_price: {
                    amount: "20000",
                    info: {
                        // token: {
                        //     contract_addr: "terraxxx"
                        // },
                        native_token: {
                            denom: "upebble"
                        }
                    },                   
                },
            }
        },
        executeFee,
        "",
        [{denom: "upebble", amount: "20000"}]
    );
    console.log("res: ", create_result);
}

const withdrawListing = async (contract_address) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(400_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contract_address,  
        {
            withdraw_listing: {
                listing_id: "AUCTION.1",  //nft address
            }
        },
        executeFee,
        "",
        []
    );
    console.log("res: ", create_result);
}

const queryAuctionIds = async (contractAddress) => {
    const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(
        contractAddress, 
        {
            "all_auction_ids": { }
        } );
	console.info("query result", query_result);
}

const queryCw721NFTInfo = async (contractAddress) => {
    const client = await CosmWasmClient.connect(rpcEndpoint);
	const query_result = await client.queryContractSmart(
        contractAddress, 
        {
            "nft_info": {
                "token_id": "mynft6",
            }
        } );
	console.info("query result", query_result.extension);

}


const cw721Mint = async (contractAddress) => {
    const gasPrice = GasPrice.fromString("0.05upebble");

    const sender_wallet = await DirectSecp256k1HdWallet.fromMnemonic(sender.mnemonic, { prefix: "wasm" });
    const sender_client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, sender_wallet);

    const executeFee = calculateFee(300_000, gasPrice);
    const create_result = await sender_client.execute(
        sender.address, 
        contractAddress,  
        {
            mint: {
                // msg: {
                    owner: sender.address,
                    token_id: "mynft6",
                    token_uri: "https://glassflow",
                    extension: 
                     {
                        "collection": "1",
                        "description": "glassflow nfts",
                        "external_link": "https://external",
                        "image_uri": "https://image/image.png",
                        "init_price": "10000",
                        "name": "mynft",
                        "num_nfts": "1",
                        "num_real_repr": "1",
                        "royalties": [
                            {
                                "address": sender.address,
                                "royalty_rate": "0.1"
                            },
                            {
                                "address": recipient.address,
                                "royalty_rate": "0.2"
                            }
                        ]
                    }

                // }
            }
        }, 
        executeFee,
        "",
        [] //
    );
}

const test = async () => {
    // contractAddress = "wasm1e4x4gy5nxld4q80vy5dtph8tvljfhllvu58ja62lvldneuntkz2s4ldl4r";
    // cw721_address = "wasm1xxyv2txe5fsnh7l30wymfzjt2ewzqhvuhes8n2t8kgrswkncye4qfgu2yz";
    const contractAddress = await auction_deploy();
    const cw721_address = await cw721_deploy(contractAddress);
    await setNftAddress(contractAddress, cw721_address);

        /*--------------  minting NFTs ----------------*/
    await updateMinters(contractAddress);
    await queryMinters(contractAddress);
    await mint(contractAddress); 
    await queryNFTIds(contractAddress);
    await queryNFTInfo(contractAddress);

    await placeListing(contractAddress);
    await queryAuctionIds(contractAddress);
    await bidListing(contractAddress);

    await withdrawListing(contractAddress);
    // await cw721Mint(cw721_address);
    // await queryCw721NFTInfo(cw721_address);
}

test();