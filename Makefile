
test:
	@./node_modules/.bin/mocha \
		--bail \
		--timeout 500

.PHONY: test
