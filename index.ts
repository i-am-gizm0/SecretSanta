import { readFileSync, writeFileSync } from "fs";
import path from "path";
import readline from "readline";
import sgMail, { MailDataRequired } from "@sendgrid/mail";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let uninterrupted = false;
rl.question("Continue uninterrupted? [y/N]: ", (answer) => {
  uninterrupted = answer.toLowerCase() === "y";
  if (uninterrupted) {
    rl.close();
  }
  generateMatches();
});

const input: {
  people: {
    name: string;
    emailName: string;
    email: string;
    cc?: string[];
  }[];
  preventMatches: string[][];
  sendgrid: {
    apiKey: string;
    from: { name: string; email: string };
    replyTo?: { name: string; email: string };
    subject: string;
  };
} = JSON.parse(readFileSync(path.join(__dirname, "input.json")).toString());
let emailEnabled: boolean;
try {
  sgMail.setApiKey(input.sendgrid.apiKey);
  emailEnabled = true;
} catch (e) {
  console.warn(`Couldn't log into Sendgrid:`, e);

  emailEnabled = false;
}

let matches: string[][];

function generateMatches() {
  do {
    matches = shuffle(
      Array.from(input.people.map((person) => person.name)).map((person) => [
        person,
      ])
    );

    const unmatched = shuffle(
      Array.from(input.people.map((person) => person.name))
    );

    let shouldContinue = false;
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      const [first, ...rest] = match;
      // if (!unmatched) {shouldContinue = true; break;}
      rest.push(<string>unmatched.pop());
      const newMatch = [first, ...rest];
      if (isValidMatch(newMatch)) {
        matches[index] = newMatch;
      } else {
        shouldContinue = true;
        break;
      }
    }
    if (shouldContinue) {
      continue;
    }
  } while (!allValidMatches());

  if (!uninterrupted) {
    console.log(matches.map((match) => match.join(" buys for ")).join("\n"));
    rl.question("Everything look good? [y/N]", (answer) => {
      if (answer.toLowerCase() === "y") {
        generateEmails();
      } else {
        console.log(`Aborting`);
        rl.close();
      }
    });
  } else {
    generateEmails();
  }
}

// rl.question('Everything look good? [y/N]', (answer) => {
//     if (answer.toLowerCase() === 'y') {
function generateEmails() {
  const emails = matches.map(generateMailFromMatch);

  if (!uninterrupted) {
    console.log(`Emails:`, emails);

    rl.question("Everything look good? [y/N]", (answer) => {
      if (answer.toLowerCase() === "y") {
        sendEmails(emails);
      } else {
        console.log(`Aborting`);
      }
      rl.close();
    });
  } else {
    sendEmails(emails);
  }
}

function sendEmails(emails: MailDataRequired[]) {
  writeFileSync(
    path.join(__dirname, "output.json"),
    JSON.stringify({ matches, emails })
  );
  if (emailEnabled) {
    console.log(`Emails and matches written to output.json`);
    emails.forEach((email) => {
      console.log(
        `Sending email to ${(<{ name?: string; email: string }>email.to).email}`
      );
      sgMail
        .send(email)
        .then(() => {
          console.log(
            `Email sent to ${
              (<{ name?: string; email: string }>email.to).email
            }`
          );
        })
        .catch((error) => {
          console.log(
            `Error sending email to ${
              (<{ name?: string; email: string }>email.to).email
            }`,
            error
          );
        });
    });
  } else {
    console.log(
      `Emails and matches written to output.json, but emails were not sent (check the log above for more details)`
    );
  }
}

// Fisher-Yates Shuffle
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle<T>(array: T[]) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

function allValidMatches(): boolean {
  const areValid = matches.every(isValidMatch) && matches.every(isFullCircular);
  // console.log(matches, `areValid: ${areValid}`);
  return areValid;
}

function isValidMatch(match: string[]): boolean {
  // console.log(`Checking if ${match.toString()} is valid`);
  if (match[0] === undefined || match[1] === undefined) {
    return false;
  }
  const isValid = match.every(personValidInMatch);
  // console.log(`${match.toString()} is ${isValid ? 'valid' : 'invalid'}`);
  return isValid;
}

function isFullCircular(match: string[]): boolean {
  const depth = circularDepth({
    matches,
    startIndex: matches.findIndex((m) => m === match),
  });
  const is = depth === matches.length - 1;
  // console.log(`${matches.map(match => match.join('>'))} has depth ${depth} starting at ${match}, which ${is ? 'is' : 'isn\'t'} a full circle`);
  return is;
}

function circularDepth({
  matches,
  startIndex,
}: {
  matches: string[][];
  startIndex: number;
}): number {
  let depth = 0;
  let currentIndex = startIndex;
  while (true) {
    const match = matches[currentIndex];
    // console.log({matches, match, currentIndex});
    const [_, ...rest] = match;
    const nextIndex = matches.findIndex(
      ([otherFirst]) => otherFirst === rest[0]
    );
    if (nextIndex === startIndex) {
      return depth;
    }
    currentIndex = nextIndex;
    depth++;
  }
}

function personValidInMatch(
  person: string | undefined,
  _: any,
  match: (string | undefined)[]
): boolean {
  // console.log(`Checking if ${person} is valid in ${match.toString()}`);
  const isValid = !person
    ? true
    : !match
        .filter((p) => p !== person) // Remove ourselves, we can't match with ourselves
        .some(
          (other) =>
            other &&
            allPersonsPreventMatches(person).some((preventMatch) =>
              preventMatch.includes(other)
            ) // Check if we can't match with someone who prevents us
        );
  // console.log(`${person} is ${isValid ? 'valid' : 'invalid'}`);
  return isValid;
}

function allPersonsPreventMatches(person: string) {
  return input.preventMatches.filter((preventMatch) =>
    preventMatch.includes(person)
  );
}

function generateMailFromMatch(match: string[]) {
  const person = input.people.find((p) => p.name === match[0]);
  const other = input.people.find((p) => p.name === match[1]);
  if (!person || !other) {
    throw new Error(`Missing person: ${{ match, person, other }}`);
  }
  const msg: MailDataRequired = {
    to: {
      name: person.emailName,
      email: person.email,
    },
    from: input.sendgrid.from,
    cc: "cc" in person ? person.cc : undefined,
    replyTo: input.sendgrid.replyTo || input.sendgrid.from,
    subject: input.sendgrid.subject,
    /* TODO: Change the following line to personalize it.
     * You could make this fancy and have it call a function to extensively personalize it (for each person)
     * or just expand it a bit and use the same template for everyone.
     */
    html: `Hi ${person.emailName}!<br><br>You will be buying a gift for <b><a href="mailto:${other.email}">${other.name}</a></b>!<br><br>Merry Christmas and happy shopping!`,
  };
  return msg;
}
