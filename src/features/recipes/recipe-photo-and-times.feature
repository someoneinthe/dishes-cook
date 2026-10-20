Feature: A recipe's photo and times
  A recipe can have a photo and its preparation and cooking times (minutes).
  The photo is taken or picked from the gallery in the form, cropped, and saved
  resized (1280 px on its long side); removing it asks first. Both show on the
  recipe's page, on the meal choice's card and in the shared PDF, and sync with
  the server like the rest of the recipe. Read-only on a TV.

  Scenario: The times are written in the form and shown on the recipe
    Given I am writing a new recipe "Leek soup"
    When I give it 15 minutes of preparation and 30 of cooking
    And I save the recipe
    Then the recipe shows "Preparation 15 min · Cooking 30 min · 45 min in all"

  Scenario: A time that isn't a number of minutes is refused
    Given I am writing a new recipe "Leek soup"
    When I give it "a while" of preparation
    And I save the recipe
    Then I'm asked for a number of minutes
    And the recipe isn't saved

  Scenario: A photo is added from the gallery, and removed after confirming
    Given the recipe "Leek soup" exists
    When I edit it and add a photo from the gallery
    And I save the recipe
    Then the recipe shows its photo
    When I edit it and remove the photo
    And I confirm the removal
    And I save the recipe
    Then the recipe shows no photo
