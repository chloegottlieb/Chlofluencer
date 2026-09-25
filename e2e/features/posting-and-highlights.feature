Feature: Posting stories and saving highlights

  Scenario: Post a text story
    Given I am logged in
    When I tap the "+" tab
    And I type "My first vlog day!" and choose a background
    And I add the tags "#vlog #travel"
    And I tap "Share to your story"
    Then "Your story" in the tray shows a ring
    And tapping it plays my story with a view count

  Scenario: Post a photo story
    Given I am logged in
    When I choose a photo in the Photo / Video tab and share it
    Then my story plays the photo

  Scenario: Save my story to a new highlight from the viewer
    Given I have posted a story
    When I open my story and tap "Highlight"
    And I create a highlight called "Best of"
    Then I see "Saved to new highlight Best of"
    And my profile shows the "Best of" highlight
    And other users can watch it even after the story expires

  Scenario: Build a highlight from the archive
    Given I have posted two stories
    When I open Archive and select both stories
    And I add them to a new highlight called "Trips"
    Then my profile shows the "Trips" highlight with 2 stories

  Scenario: Delete a story
    Given I have posted a story
    When I open my story and tap "Delete" and confirm
    Then the story is gone from my tray
