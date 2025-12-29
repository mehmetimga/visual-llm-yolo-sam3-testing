Feature: Flutter Casino Lobby Test

  Tests casino lobby functionality on Flutter app.
  Assumes the app is already on the lobby screen.

  Scenario: Navigate games from lobby
    Given I am on the lobby page
    Then I should see text "Casino Lobby"
    And "join_now_button" should be visible
    When I tap "slots_game"
    Then I should see text "Mega Slots"
    When I tap "back_button"
    Then I should see text "Casino Lobby"

  @vision
  Scenario: Play slots game
    Given I am on the lobby page
    When I tap "slots_game"
    Then I should see text "Mega Slots"
    When I tap "spin_button" using vision
    Then "balance_display" should be visible
    When I tap "back_button"
    Then I should see text "Casino Lobby"




