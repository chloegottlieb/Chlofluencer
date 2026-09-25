Feature: Accounts and profiles
  As a new creator
  I want to sign up and build a profile
  So that people who discover my stories can learn about me

  Scenario: Sign up with interests
    Given I am on the sign up page
    When I enter a unique username, email and a valid password
    And I pick the interests "#travel" and "#food"
    And I submit the form
    Then I land on the home screen with the stories tray
    And my profile lists the interests "#travel" and "#food"

  Scenario: Log in with the demo account
    Given the demo data has been seeded
    When I log in as "demo" with password "password123"
    Then I see my friends "maya.travels", "leo.lifts" and "priya.cooks" in the stories tray
    And I see a "For You" section of creators I don't follow

  Scenario: Log in with a wrong password
    When I log in as "demo" with password "wrong-password1"
    Then I see the error "Incorrect username or password"

  Scenario: Edit my profile picture and bio
    Given I am logged in
    When I open "Edit profile"
    And I upload a profile picture
    And I set my bio to "Vlogging my life one story at a time"
    And I save
    Then my profile shows the bio and my new profile picture

  Scenario: Bio length is limited
    Given I am logged in
    When I enter a bio longer than 150 characters and save
    Then I see the error "Bio must be 150 characters or fewer"
