@flutter @poker
Feature: Poker Session - Play 5 Complete Hands

  Complete poker session: login, play 5 full hands, return to lobby, logout.

  @smoke @full-session
  Scenario: Play 5 complete poker hands then logout
    # === LOGIN ===
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"

    # === NAVIGATE TO POKER TABLE ===
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"

    # === PLAY HANDS (state-agnostic) ===
    # This uses YOLO detections + the proven 100ms press pattern to click Rive buttons.
    # It DOES NOT assume "DEAL AGAIN" is present; it will only click DEAL/DEAL AGAIN when visible.
    When AI plays 5 poker hands

    # === RETURN TO LOBBY ===
    When I tap "back_button"
    And I wait 2 seconds
    Then I should see text "Casino Lobby"

    # === LOGOUT ===
    When I tap "logout_button"
    And I wait 1 seconds
    Then I should see text "Log In"
