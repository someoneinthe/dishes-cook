Feature: Sharing a recipe
  A recipe's page shares it as a PDF (Share as PDF, at the top), through the
  phone's share sheet: messages, email, a drive… The PDF is made on the phone,
  in the reader's language and units (A4 pages, or US Letter with US units),
  and named after the recipe. It's a temporary file: the app deletes it on
  coming back from the share sheet, and deletes any leftover when it starts.
  There's no history of what was shared, and no import: a PDF can't come back
  into the app. Not on a TV.

  Scenario: A recipe is shared as a PDF named after it
    Given the recipe "Leek soup" with 3 leeks
    When I open "Leek soup"
    And I share it as a PDF
    Then a PDF of "Leek soup" listing "Leek: 3" is shared
    And the PDF is deleted afterwards

  Scenario: A PDF that can't be made is explained
    Given the recipe "Leek soup" with 3 leeks
    And PDFs can't be made
    When I open "Leek soup"
    And I share it as a PDF
    Then I'm told the PDF couldn't be made
