Feature: In a browser
  In a desktop browser, the web app, which the sync server serves, works like
  the phone's app without a camera: photos and recipe pages are files chosen
  on the computer. The About page says where a browser keeps the data.

  Scenario: A new recipe is written or read from a file, without a camera
    When I start a new recipe in a browser
    Then I can write it or choose a file, not take a photo
    And I am told the file is read in the browser

  Scenario: A recipe's photo is chosen among the computer's files right away
    When I add a photo to a recipe in a browser
    Then the file picker opens, without asking where the photo comes from

  Scenario: The About page says where the browser keeps the data
    When I open the About page in a browser
    Then I am told my data is saved in this browser, which can clear it
    And I am told the sign-in token stays in this site's storage

  Scenario: The sync server's address is the web app's
    When I set up the sync in a browser opened on "https://recipes.example.org"
    Then the server address is "https://recipes.example.org"
