# Secret Santa Picker

A simple yet flexible Secret Santa generator which allows preventing certain users from matching with each other (e.g. spouses) and ensures that only one loop is formed (no isolated groups).

## Installation

Clone the repository with

```bash
git clone https://github.com/i-am-gizm0/secretsanta.git
cd secretsanta
```

Install the dependencies with

```bash
npm install
```

## Usage

Copy the `input.json.example` file to `input.json` and change the values to your liking.

### Disabling Emails

To disable sending emails, replace the sendgrid config like so:

```json
{
    ...
    "sendgrid": {}
}
```

### Preventing Matches

To prevent certain people from matching with each other add an array to `preventMatches`. Any people in that array will not be matched with each other. People can appear in multiple arrays:

```json
{
    ...
    "preventMatches": [
        ["Alice", "Bob"],
        ["Bob", "Charlie"]
    ],
    ...
}
```

In this case, Alice and Bob and Bob and Charlie will not be matched with each other, but Alice and Charlie could.

## Contributing

This is by no means the best or more efficient way to implement these algorithms, but they were all I needed so they are how they are. **If you have any suggestions, please open an issue or a pull request.**
