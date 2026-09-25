Feature: Direct messages and story replies
  Two people who follow each other can DM. Otherwise, the only way to reach
  a creator is a one-way story reply, which they can read but not answer.

  Scenario: Mutual follows can message each other
    Given "alex" and "blair" follow each other
    When alex opens Messages and starts a new message to blair
    And alex sends "Coffee later?"
    Then blair sees an unread badge on the Messages icon
    And blair opens the conversation and sees "Coffee later?"
    When blair replies "Yes! 3pm"
    Then alex sees "Yes! 3pm" in the conversation
    And alex's message is marked "Seen"

  Scenario: A story reply between mutuals goes to DMs
    Given "alex" and "blair" follow each other
    And blair has posted a story
    When alex opens blair's story
    Then the reply box says "Message blair…"
    When alex sends "Where is this?!"
    Then alex sees "Sent to your messages"
    And blair's conversation with alex shows the reply with a preview of the story
    And blair can reply in the conversation

  Scenario: One-way follow gives a one-way story reply
    Given "fan" follows "creator" but creator does not follow back
    And creator has posted a story
    When fan opens creator's story
    Then the reply box says "Reply to creator…"
    When fan sends "Huge fan!"
    Then fan sees "Reply sent"
    And creator sees "Huge fan!" under Activity → Story replies marked "One-way reply"
    And creator has no conversation with fan in Messages
    And fan's profile has no "Message" button for creator

  Scenario: Strangers can only reply to stories
    Given "stranger" and "creator" don't follow each other
    When stranger visits creator's profile
    Then there is no "Message" button
    And opening creator's conversation directly shows "once you both follow each other" with no message box

  Scenario: Unfollowing makes a conversation read-only
    Given "alex" and "blair" have been messaging
    When blair unfollows alex
    Then alex's conversation with blair still shows the history
    But the message box is replaced with "once you both follow each other"
