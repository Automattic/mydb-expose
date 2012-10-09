
test:
	@./node_modules/.bin/mocha \
		--bail \
		--slow 200 \
		--timeout 500

.PHONY: test
