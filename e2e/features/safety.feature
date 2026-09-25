Feature: Safety, moderation and legal
  Storytime has no tolerance for objectionable content or abusive users.
  People can report and block, abusive language is filtered, and moderators
  act on reports (App Store Review Guideline 1.2).

  Scenario: Terms must be accepted to sign up
    Given I am on the sign up page
    Then the "Sign up" button is disabled
    And I can open the Terms of Use, Community Guidelines and Privacy Policy
    When I tick "I agree to the Terms of Use and Community Guidelines"
    Then I can create my account

  Scenario: Legal pages are public
    Given I am not logged in
    When I open /privacy, /terms, /guidelines and /delete-account
    Then I can read each page without an account

  Scenario: Report a story and block the creator
    Given I am watching a For You story
    When I choose "Report" from the ⋯ menu
    And I pick "Spam or scam", turn on "Also block", and submit
    Then I see "Thanks for letting us know"
    And the creator's profile shows as blocked for me
    And Settings → Your reports lists my report as "In review"

  Scenario: Abusive language is blocked before it's posted
    Given I am writing a text story
    When my story contains a slur
    Then I see "That contains language that isn't allowed on Storytime"
    And nothing is posted

  Scenario: Heavily reported stories are hidden until reviewed
    Given 3 different people report the same story
    Then nobody but the author can see it
    And the author sees "Under review" on their story

  Scenario: A moderator removes a story and suspends the account
    Given a story has been reported
    When a moderator opens Settings → Moderation queue
    And chooses "Remove + suspend" on the reported story
    Then the story is gone for everyone
    And the creator can no longer log in and sees a suspension message with the support email
    And the reporter gets a "Storytime Safety" notice that action was taken

  Scenario: Report a direct message
    Given "alex" and "blair" follow each other and alex sent blair a message
    When blair taps "Report" under the message and submits a reason
    Then the message report reaches the moderation queue
