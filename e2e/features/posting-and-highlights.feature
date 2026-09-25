Feature: Posting stories and saving highlights

  Scenario: Post a text story
    Given I am logged in
    When I tap the "+" tab
    And I type "My first vlog day!" and choose a background
    And I add the tags "#vlog #travel"
    And I tap "Share to your story"
    Then "Your story" in the tray shows a ring
    And tapping it plays my story with a view count

  Scenario: Post a photo story from the camera roll
    Given I am logged in
    When I tap "Choose from camera roll" in the Photo / Video tab and pick a photo
    And I share it
    Then my story plays the photo

  Scenario: Take a photo with the in-app camera and post it
    Given I am logged in and have allowed camera access
    When I tap "Open camera" in the Photo / Video tab
    And I tap the shutter
    Then I see the photo I just took
    When I tap "Use photo" and share it
    Then my story plays the photo

  Scenario: Record a video with the in-app camera and post it
    Given I am logged in and have allowed camera access
    When I open the camera and switch to "Video"
    And I tap the shutter to start recording
    Then I see a recording timer
    When I tap the shutter again after a couple of seconds
    And I tap "Use video" and share it
    Then my story plays the video for as long as I recorded

  Scenario: Retake and flip the camera
    Given the in-app camera is open
    When I tap "Flip camera"
    Then the preview switches to the front camera, mirrored like a selfie
    When I take a photo and tap "Retake"
    Then the live camera comes back

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
