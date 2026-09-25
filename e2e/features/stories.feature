Feature: Instagram-style tap-through stories
  Stories last 24 hours and are watched by tapping, not scrolling.

  Background:
    Given I am logged in
    And I follow "friend-b" who posted 1 story
    And I follow "friend-a" who then posted 2 stories
    # Friends with the most recent unseen stories lead the tray.

  Scenario: Tap through friends' stories in order
    When I tap "Watch 2 friends' stories"
    Then I see friend-a's first story with 2 progress segments
    When I tap the right side of the screen
    Then I see friend-a's second story
    When I tap the right side of the screen
    Then I see friend-b's story
    When I tap the left side of the screen
    Then I see friend-a's second story again

  Scenario: Finishing friends' stories rolls into strangers' stories
    When I watch all of my friends' stories
    Then I see "You're all caught up"
    When I tap "Discover new creators"
    Then I see a story from a creator I don't follow
    And it is labelled "For You" with a reason such as "Trending"
    And I can keep tapping to the next recommended creator

  Scenario: Press and hold pauses the story
    When I open friend-a's story
    And I press and hold on the story
    Then the story is paused
    When I release
    Then the story resumes

  Scenario: Stories auto-advance
    When I open friend-b's story
    And I wait longer than the photo duration
    Then the viewer moves on to the next story

  Scenario: Watched friends move to the end of the tray
    When I watch friend-a's stories and close the viewer
    Then friend-a's ring is grey (seen) and appears after unseen friends

  Scenario: Like and reply to a friend's story
    When I open friend-a's story
    And I tap the heart
    And I reply "Love this!"
    Then I see "Reply sent"
    And friend-a sees my reply under Activity → Story replies
    And friend-a sees a "liked your story" notification
