Feature: On a TV
  On an Android TV, driven with the remote, the app is read-only: it
  proposes and shows recipes, which are written in the app on a phone. The
  ingredient list, only used to manage ingredients, isn't in the TV's menu.

  Scenario: A recipe is shown without edit or delete
    Given the recipe "Pumpkin soup" exists
    When I open "Pumpkin soup" on the TV
    Then I can read "Pumpkin soup"
    And it can't be edited or deleted

  Scenario: Recipes can't be added on the TV
    Given there are no recipes
    When I open the recipe list on the TV
    Then I am told that recipes are written in the app on a phone, to sync with the TV
    And no recipe can be added

  Scenario: The meal choice doesn't offer to add a recipe on the TV
    Given there are no recipes
    When I open the meal choice on the TV
    Then I am told that recipes are written in the app on a phone, to sync with the TV
    And no recipe can be added
