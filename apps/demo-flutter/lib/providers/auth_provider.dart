import 'package:flutter/material.dart';

class AuthProvider extends ChangeNotifier {
  String? _username;
  int _balance = 1000;
  bool _isLoggedIn = false;

  String? get username => _username;
  int get balance => _balance;
  bool get isLoggedIn => _isLoggedIn;

  Future<bool> login(String username, String password) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 500));

    // Simple demo authentication
    if (username == 'demo' && password == 'pw') {
      _username = username;
      _balance = 1000;
      _isLoggedIn = true;
      notifyListeners();
      return true;
    }

    return false;
  }

  void logout() {
    _username = null;
    _balance = 1000;
    _isLoggedIn = false;
    notifyListeners();
  }

  void updateBalance(int amount) {
    _balance += amount;
    if (_balance <= 0) {
      _balance = 1000;
    }
    notifyListeners();
  }

  void setBalance(int amount) {
    _balance = amount;
    if (_balance <= 0) {
      _balance = 1000;
    }
    notifyListeners();
  }
}
