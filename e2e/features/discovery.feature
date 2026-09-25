Feature: For You discovery of new creators

  Scenario: Follow a creator straight from their story
    Given I am a new user who follows nobody
    When I tap "Start watching" in the For You section
    And I tap "Follow" on the first recommended creator
    Then I see "Following <creator>"
    And after closing the viewer the creator appears in my friends' tray

  Scenario: "Not interested" hides a creator from For You
    Given I am watching For You stories
    When I choose "Not interested" from the ⋯ menu
    Then the creator no longer appears in the For You section
    And they are listed under Settings → "Hidden from For You"

  Scenario: Turning off discovery stops after friends
    Given I have turned off "Discover new creators" in Settings
    Then the home screen says discovery is off
    And no For You cards are shown

  Scenario: Recommendations match my interests
    Given I signed up with the interest "#travel"
    When I open the home screen
    Then a travel creator's card says "Because you're into #travel"

  Scenario: Private accounts never appear in For You
    Given "sam.private" has a private account with an active story
    When I browse For You
    Then I never see "sam.private"
