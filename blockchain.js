const crypto = require('crypto'),
	http = require('http'),
	{ URL } = require('url');

class Blockchain {

	constructor() {
		this.chain = [];
		this.currentTransactions = [];
		this.nodes = [];

		this.newBlock({previousHash: 1, proof: 100});
	}

	newBlock({proof, previousHash}) {
		const block = {
			index: this.chain.length + 1,
			timestamp: Date.now(),
			transactions: this.currentTransactions,
			proof,
			previousHash: previousHash || Blockchain.hash(this.chain[this.chain.length - 1])
		};

		this.currentTransactions = [];
		this.chain.push(block);
		return block;
	}

	newTransaction({sender, recipient, amount}) {
		this.currentTransactions.push({
			sender,
			recipient,
			amount
		});

		return this.lastBlock.index + 1;
	}

	get lastBlock() {
		return this.chain[this.chain.length - 1];
	}

	static hash(block) {
		const sortedKeys = Object.keys(block).sort();
		const sortedBlock = sortedKeys.map(value => ({[value]: block[value]}));
		const blockString = JSON.stringify(sortedBlock);
		return crypto.createHash('sha256').update(blockString).digest('hex');
	}

	proofOfWork(lastProof) {
		let proof = 0;
		while (!Blockchain.validProof(this.lastBlock.previousHash, lastProof, proof)) {
			proof++;
		}
		return proof;
	}

	static validProof(previousHash, lastProof, proof) {
		const guess = `${previousHash}${lastProof}${proof}`;
		const guessHash = crypto.createHash('sha256').update(guess).digest('hex');
		return guessHash.substr(-4) === '0000';
	}

	registerNode(address) {
		const host = new URL(address).host;
		if (!this.nodes.includes(host)) {
			this.nodes.push(host);
		}
	}

	static validChain(chain) {
		let lastBlock = chain[0];
		let currentIndex = 1;

		while (currentIndex < chain.length) {
			const block = chain[currentIndex];
			if (
				block.previousHash !== Blockchain.hash(lastBlock) ||
				Blockchain.validProof(block.previousHash, lastBlock.proof, block.proof)
			) {
				return false;
			}
			lastBlock = block;
			currentIndex++;
		}
		return true;
	}

	async resolveConflicts() {
		const neighbors = this.nodes;
		let newChain;
		let maxLength = this.chain.length;

		for (const node of neighbors) {
			try {
				const parsedData = await this.getNeighborChain(node);
				const { length, chain } = parsedData;
				if (length > maxLength && this.validChain(chain)) {
					maxLength = length;
					newChain = chain;
				}
			} catch (e) {
				console.error(e.message);
			}
		}

		if (newChain) {
			this.chain = newChain;
			return true;
		}
		return false;
	}

	getNeighborChain(node) {
		return new Promise((resolve, reject) => {
			http.get(`http://${node}/chain`, res => {
				if (res.statusCode === 200) {
					res.setEncoding('utf8');
					let rawData = '';
					res.on('data', (chunk) => { rawData += chunk; });
					res.on('end', () => {
						try {
							const parsedData = JSON.parse(rawData);
							resolve(parsedData);
						} catch (e) {
							reject(e);
						}
					});
				} else {
					resolve();
				}
			}).on('error', e => {
				reject(e);
			});
		});
	}
}

module.exports = Blockchain;
