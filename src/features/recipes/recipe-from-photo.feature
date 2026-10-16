Feature: A recipe from a photo
  Adding a recipe asks whether to write it or to fill it in from a photo of a recipe page, taken
  with the camera or chosen among the phone's photos (a book, a recipe website on a screen…). The text is read on the phone: the photo is neither sent nor kept.
  The title, the ingredients with their quantities and the steps fill in the form, to check before
  saving. An ingredient that already exists (same name, ignoring case) is used; a new one is only
  created when the recipe is saved. When a new one looks like an existing one (singular or plural,
  other accents: "carrot" and "Carrots"), its row asks which to keep, and the recipe can't be saved
  until the user chooses.

  Scenario: Adding a recipe asks how to start
    When I add a recipe from the recipe list
    Then I am asked whether to write it, choose a photo or take one
    When I choose a photo of "Leek soup" listing "2 leeks"
    Then the new recipe opens filled in with "Leek soup" and "leeks: 2"

  Scenario: A photo fills in a new recipe
    Given the ingredients "Leek" exist
    When I fill in a new recipe from a photo of "Leek soup" listing "2 leek, 500 g potatoes"
    And I save the recipe
    Then the recipe "Leek soup" lists "Leek: 2, potatoes: 500 g"
    And the ingredients are "Leek, potatoes"

  Scenario: New ingredients are only created when the recipe is saved
    When I fill in a new recipe from a photo of "Leek soup" listing "2 leeks"
    Then no ingredient exists yet

  Scenario: An ingredient like an existing one asks which to keep
    Given the ingredients "Carrots" exist
    When I fill in a new recipe from a photo of "Carrot salad" listing "3 carrot"
    Then I am told I already have "Carrots"
    When I save the recipe
    Then I am asked to choose before saving
    And no recipe is saved
    When I use "Carrots"
    And I save the recipe
    Then the recipe "Carrot salad" lists "Carrots: 3"
    And the ingredients are "Carrots"

  Scenario: The new ingredient can be kept
    Given the ingredients "Carrots" exist
    When I fill in a new recipe from a photo of "Carrot salad" listing "3 carrot"
    And I keep the new "carrot"
    And I save the recipe
    Then the recipe "Carrot salad" lists "carrot: 3"
    And the ingredients are "carrot, Carrots"

  Scenario: The camera needs my permission
    Given I refuse the camera
    When I try to take a photo for a new recipe
    Then I am told to allow the camera or to choose an existing photo

  Scenario: A photo without text
    When I fill in a new recipe from a photo without text
    Then I am told that no recipe was found
