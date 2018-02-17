const express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	uuid = require('uuid4'),
	Blockchain = require('./Blockchain');

const nodeIdentifier = uuid();
const blockchain = new Blockchain();

app.use(bodyParser.json());

app.get('/mine', (req, res) => {
	const lastBlock = blockchain.lastBlock;
	const lastProof = lastBlock.proof;
	const proof = blockchain.proofOfWork(lastProof);

	blockchain.newTransaction({sender: "0", recipient: nodeIdentifier, amount: 1});

	const previousHash = Blockchain.hash(lastBlock);
	const block = blockchain.newBlock({proof, previousHash});

	res.status(200).json({
		message: 'New Block Forged',
		index: block.index,
		proof,
		previousHash: block.previousHash,
		transactions: block.transactions
	});
});

app.post('/transactions/new', (req, res) => {
	const values = req.body;
	const required = ['sender', 'recipient', 'amount'];
	if (!required.every(requiredValue => values.hasOwnProperty(requiredValue))) {
		return res.status(400).send('Missing values');
	}
	const index = blockchain.newTransaction(values);

	res.status(201).json({
		message: `Transaction will be added to Block ${index}`
	});
});

app.get('/chain', (req, res) => {
	res.status(200).json({
		chain: blockchain.chain,
		length: blockchain.chain.length
	});
});

app.post('/nodes/register', (req, res) => {
	const { nodes } = req.body;
	if (!nodes) {
		return res.status(400).send('Error: Please supply a valid list of nodes');
	}

	for (const node of nodes) {
		blockchain.registerNode(node);
	}

	res.status(201).json({
		message: 'New nodes have been added',
		totalNodes: blockchain.nodes
	});
});

app.get('/nodes/resolve', async (req, res) => {
	const replaced = await blockchain.resolveConflicts();
	let response;
	if (replaced) {
		response = {
			message: 'Our chain was replaced',
			newChain: blockchain.chain
		};
	} else {
		response = {
			message: 'Our chain is authoritative',
			chain: blockchain.chain
		};
	}
	res.status(200).json(response);
});

const port = 3000;
app.listen(port, () => console.log(`App listening on port ${port}!`));
