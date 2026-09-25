Feature: Privacy and settings

  Scenario: Private account requires follow approval
    Given "owner" has turned on "Private account"
    When "fan" visits owner's profile
    Then fan sees "This account is private"
    When fan taps "Follow"
    Then the button says "Requested"
    When owner confirms the request under Activity
    Then fan can see owner's highlights

  Scenario: Block a user
    Given I visit "pest"'s profile
    When I choose "Block" from the ⋯ menu
    Then pest can no longer find my profile
    And pest appears under Settings → Blocked accounts where I can unblock them

  Scenario: Turn off story replies
    Given I set "Allow story replies from" to "Off"
    When a follower opens my story
    Then they see "Replies are off" instead of the reply box

  Scenario: Switch to light theme
    When I set "Theme" to "Light"
    Then the app renders with the light theme

  Scenario: Change password
    When I change my password
    Then I can log in with the new password and not the old one
